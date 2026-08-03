import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import type { KafkaConfig } from 'kafkajs';
import {
  LOG_EVENTS_TOPIC,
  type LogEvent,
  LoggerPlugin,
} from '../../src/plugin/LoggerPlugin';

function makeMockKafka() {
  const state = {
    configs: [] as KafkaConfig[],
    adminConnected: false,
    adminDisconnected: false,
    createdTopics: [] as string[],
    producerConnected: false,
    producerDisconnected: false,
    sent: [] as { topic: string; messages: { value: string }[] }[],
    failNextSend: false,
  };

  const admin = {
    connect: async () => {
      state.adminConnected = true;
    },
    disconnect: async () => {
      state.adminDisconnected = true;
    },
    createTopics: async ({ topics }: { topics: { topic: string }[] }) => {
      state.createdTopics.push(...topics.map((t) => t.topic));
    },
  };

  const producer = {
    connect: async () => {
      state.producerConnected = true;
    },
    disconnect: async () => {
      state.producerDisconnected = true;
    },
    send: async (payload: { topic: string; messages: { value: string }[] }) => {
      if (state.failNextSend) throw new Error('kafka is down');
      state.sent.push(payload);
    },
  };

  const createKafka = (config: KafkaConfig) => {
    state.configs.push(config);
    return {
      admin: () => admin,
      producer: () => producer,
    } as any;
  };

  return { state, createKafka };
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

test('onStart() provisions the shared topic, connects the producer, and registers logger', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const plugin = new LoggerPlugin(container, 'my-service', mock.createKafka);

  await plugin.onStart();

  expect(mock.state.adminConnected).toBe(true);
  expect(mock.state.createdTopics).toEqual([LOG_EVENTS_TOPIC]);
  expect(mock.state.adminDisconnected).toBe(true);
  expect(mock.state.producerConnected).toBe(true);
  expect(container.resolve('logger')).toBeDefined();
});

test('logger.info() publishes a LogEvent with service/status/message/file/line', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const plugin = new LoggerPlugin(container, 'my-service', mock.createKafka);
  await plugin.onStart();

  const logger = container.resolve<import('../../src/plugin/LoggerPlugin').Logger>('logger');
  logger.info('hello world');
  await new Promise((r) => setTimeout(r, 0));

  expect(mock.state.sent).toHaveLength(1);
  expect(mock.state.sent[0]?.topic).toBe(LOG_EVENTS_TOPIC);
  const event: LogEvent = JSON.parse(mock.state.sent[0]?.messages[0]?.value ?? '{}');
  expect(event.service).toBe('my-service');
  expect(event.status).toBe('info');
  expect(event.message).toBe('hello world');
  expect(event.file).toContain('LoggerPlugin.test.ts');
  expect(typeof event.line).toBe('number');
  expect(event.line).toBeGreaterThan(0);
});

test('logger.error() sets status to "error"', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const plugin = new LoggerPlugin(container, 'my-service', mock.createKafka);
  await plugin.onStart();

  const logger = container.resolve<import('../../src/plugin/LoggerPlugin').Logger>('logger');
  logger.error('boom');
  await new Promise((r) => setTimeout(r, 0));

  const event: LogEvent = JSON.parse(mock.state.sent[0]?.messages[0]?.value ?? '{}');
  expect(event.status).toBe('error');
});

test('a failed send() falls back to console instead of throwing', async () => {
  const mock = makeMockKafka();
  mock.state.failNextSend = true;
  const container = makeContainer();
  const plugin = new LoggerPlugin(container, 'my-service', mock.createKafka);
  await plugin.onStart();

  const logger = container.resolve<import('../../src/plugin/LoggerPlugin').Logger>('logger');
  expect(() => logger.info('will fail to send')).not.toThrow();
  await new Promise((r) => setTimeout(r, 0));
});

test('onStop() disconnects the producer', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const plugin = new LoggerPlugin(container, 'my-service', mock.createKafka);

  await plugin.onStart();
  await plugin.onStop();

  expect(mock.state.producerDisconnected).toBe(true);
});

test('onStop() is safe when onStart() was never called', async () => {
  const container = makeContainer();
  const plugin = new LoggerPlugin(container);

  await expect(plugin.onStop()).resolves.toBeUndefined();
});
