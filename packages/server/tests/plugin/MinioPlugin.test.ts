import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import type { Client } from 'minio';
import { MinioPlugin } from '../../src/plugin/MinioPlugin';

function makeMockMinio(healthy = true) {
  const state = { listedBuckets: false };
  const client = {
    listBuckets: async () => {
      state.listedBuckets = true;
      if (!healthy) {
        throw new Error('minio unreachable');
      }
      return [];
    },
  };
  const createClient = () => client as unknown as Client;
  return { client, state, createClient };
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

test('onStart() checks connectivity and registers the client in the container', async () => {
  const mock = makeMockMinio();
  const container = makeContainer();
  const plugin = new MinioPlugin(container, mock.createClient);

  await plugin.onStart();

  expect(mock.state.listedBuckets).toBe(true);
  expect(container.resolve('minio')).toBe(mock.client);
});

test('onStart() propagates a failing connectivity check', async () => {
  const mock = makeMockMinio(false);
  const container = makeContainer();
  const plugin = new MinioPlugin(container, mock.createClient);

  await expect(plugin.onStart()).rejects.toThrow('minio unreachable');
});

test('onStop() is a no-op after onStart()', async () => {
  const mock = makeMockMinio();
  const container = makeContainer();
  const plugin = new MinioPlugin(container, mock.createClient);

  await plugin.onStart();

  await expect(plugin.onStop()).resolves.toBeUndefined();
});

test('onStop() is safe when onStart() was never called', async () => {
  const container = makeContainer();
  const plugin = new MinioPlugin(container);

  await expect(plugin.onStop()).resolves.toBeUndefined();
});
