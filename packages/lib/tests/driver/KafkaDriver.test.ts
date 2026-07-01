import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import type { Kafka } from 'kafkajs';
import type { BaseRouter } from '../../src/abstract/BaseRouter';
import { KafkaDriver } from '../../src/driver/KafkaDriver';

function makeMockKafka() {
  const state = {
    adminConnected: false,
    adminDisconnected: false,
    createdTopics: undefined as { topic: string }[] | undefined,
    producerConnected: false,
    producerDisconnected: false,
    consumerFactoryCalled: false,
    consumerConfig: undefined as { groupId: string } | undefined,
    consumerConnected: false,
    consumerDisconnected: false,
    subscribed: undefined as { topics: string[] } | undefined,
    runConfig: undefined as
      | { eachMessage: (payload: unknown) => Promise<void> }
      | undefined,
  };

  const admin = {
    connect: async () => {
      state.adminConnected = true;
    },
    createTopics: async (opts: { topics: { topic: string }[] }) => {
      state.createdTopics = opts.topics;
    },
    disconnect: async () => {
      state.adminDisconnected = true;
    },
  };

  const producer = {
    connect: async () => {
      state.producerConnected = true;
    },
    disconnect: async () => {
      state.producerDisconnected = true;
    },
  };

  const consumer = {
    connect: async () => {
      state.consumerConnected = true;
    },
    subscribe: async (opts: { topics: string[] }) => {
      state.subscribed = opts;
    },
    run: async (config: {
      eachMessage: (payload: unknown) => Promise<void>;
    }) => {
      state.runConfig = config;
    },
    disconnect: async () => {
      state.consumerDisconnected = true;
    },
  };

  const configs: unknown[] = [];
  const createKafka = (config: unknown) => {
    configs.push(config);
    return {
      admin: () => admin,
      producer: () => producer,
      consumer: (consumerConfig: { groupId: string }) => {
        state.consumerFactoryCalled = true;
        state.consumerConfig = consumerConfig;
        return consumer;
      },
    } as unknown as Kafka;
  };

  return { admin, producer, consumer, state, configs, createKafka };
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

class StubKafkaRouter {
  topics = { 'demo1.events': {} };
  dispatchers: Record<string, (payload: Uint8Array) => Promise<void>>;
  received: Uint8Array[] = [];

  constructor() {
    this.dispatchers = {
      'demo1.events': async (payload: Uint8Array) => {
        this.received.push(payload);
      },
    };
  }

  register() {}
}

const defaultOptions = {
  port: 3000,
  host: '0.0.0.0',
  interceptors: [],
};

test('start() always connects a producer and registers it in the container', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const driver = new KafkaDriver({}, mock.createKafka);

  await driver.start({
    ...defaultOptions,
    routers: [],
    plugins: [],
    container,
  });

  expect(mock.state.producerConnected).toBe(true);
  expect(container.resolve('kafkaProducer')).toBe(mock.producer);
  expect(container.resolve('kafka')).toBeDefined();
});

test('start() does not touch the admin API when no topics are declared anywhere', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const driver = new KafkaDriver({}, mock.createKafka);

  await driver.start({
    ...defaultOptions,
    routers: [],
    plugins: [],
    container,
  });

  expect(mock.state.adminConnected).toBe(false);
});

test('start() provisions config.topics even with no consumer router (producer-only server)', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const driver = new KafkaDriver(
    { topics: { 'demo1.events': { decode: () => ({}) } } },
    mock.createKafka,
  );

  await driver.start({
    ...defaultOptions,
    routers: [],
    plugins: [],
    container,
  });

  expect(mock.state.adminConnected).toBe(true);
  expect(mock.state.createdTopics).toEqual([{ topic: 'demo1.events' }]);
  expect(mock.state.adminDisconnected).toBe(true);
  expect(mock.state.consumerFactoryCalled).toBe(false);
});

test('start() provisions topics declared by a KafkaConsumerRouter', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const router = new StubKafkaRouter();
  const driver = new KafkaDriver({}, mock.createKafka);

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    plugins: [],
    container,
  });

  expect(mock.state.createdTopics).toEqual([{ topic: 'demo1.events' }]);
});

test('start() subscribes and runs a consumer when a router declares topics', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const router = new StubKafkaRouter();
  const driver = new KafkaDriver({ groupId: 'my-group' }, mock.createKafka);

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    plugins: [],
    container,
  });

  expect(mock.state.consumerConfig).toEqual({ groupId: 'my-group' });
  expect(mock.state.consumerConnected).toBe(true);
  expect(mock.state.subscribed).toEqual({ topics: ['demo1.events'] });
  expect(mock.state.runConfig).toBeDefined();
});

test('eachMessage dispatches to the matching router handler', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const router = new StubKafkaRouter();
  const driver = new KafkaDriver({}, mock.createKafka);

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    plugins: [],
    container,
  });

  const value = new TextEncoder().encode('hello');
  await mock.state.runConfig?.eachMessage({
    topic: 'demo1.events',
    message: { value },
  });

  expect(router.received).toEqual([value]);
});

test('start() reads brokers/clientId from config over env vars', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const driver = new KafkaDriver(
    { brokers: ['broker1:9092'], clientId: 'my-client' },
    mock.createKafka,
  );

  await driver.start({
    ...defaultOptions,
    routers: [],
    plugins: [],
    container,
  });

  expect(mock.configs[0]).toEqual({
    brokers: ['broker1:9092'],
    clientId: 'my-client',
  });
});

test('stop() disconnects the producer, and the consumer if one was created', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const router = new StubKafkaRouter();
  const driver = new KafkaDriver({}, mock.createKafka);

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    plugins: [],
    container,
  });
  await driver.stop();

  expect(mock.state.producerDisconnected).toBe(true);
  expect(mock.state.consumerDisconnected).toBe(true);
});

test('stop() is safe when no consumer was ever created', async () => {
  const mock = makeMockKafka();
  const container = makeContainer();
  const driver = new KafkaDriver({}, mock.createKafka);

  await driver.start({
    ...defaultOptions,
    routers: [],
    plugins: [],
    container,
  });
  await expect(driver.stop()).resolves.toBeUndefined();
});
