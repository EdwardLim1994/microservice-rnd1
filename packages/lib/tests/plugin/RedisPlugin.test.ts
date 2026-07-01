import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import type { RedisClient } from 'bun';
import { RedisPlugin } from '../../src/plugin/RedisPlugin';

function makeMockRedis() {
  const state = { connected: false, closed: false };
  const client = {
    connect: async () => {
      state.connected = true;
    },
    close: () => {
      state.closed = true;
    },
  };
  const createClient = async () => client as unknown as RedisClient;
  return { client, state, createClient };
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

test('onStart() connects the client and registers it in the container', async () => {
  const mock = makeMockRedis();
  const container = makeContainer();
  const plugin = new RedisPlugin(container, mock.createClient);

  await plugin.onStart();

  expect(mock.state.connected).toBe(true);
  expect(container.resolve('redis')).toBe(mock.client);
});

test('onStop() closes the client', async () => {
  const mock = makeMockRedis();
  const container = makeContainer();
  const plugin = new RedisPlugin(container, mock.createClient);

  await plugin.onStart();
  await plugin.onStop();

  expect(mock.state.closed).toBe(true);
});

test('onStop() is safe when onStart() was never called', async () => {
  const container = makeContainer();
  const plugin = new RedisPlugin(container);

  await expect(plugin.onStop()).resolves.toBeUndefined();
});
