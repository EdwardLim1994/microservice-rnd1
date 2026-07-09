import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import type { MeiliSearch } from 'meilisearch';
import { MeilisearchPlugin } from '../../src/plugin/MeilisearchPlugin';

function makeMockMeilisearch(healthy = true) {
  const state = { healthChecked: false };
  const client = {
    health: async () => {
      state.healthChecked = true;
      if (!healthy) {
        throw new Error('meilisearch unreachable');
      }
      return { status: 'available' };
    },
  };
  const createClient = () => client as unknown as MeiliSearch;
  return { client, state, createClient };
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

test('onStart() checks health and registers the client in the container', async () => {
  const mock = makeMockMeilisearch();
  const container = makeContainer();
  const plugin = new MeilisearchPlugin(container, mock.createClient);

  await plugin.onStart();

  expect(mock.state.healthChecked).toBe(true);
  expect(container.resolve('meilisearch')).toBe(mock.client);
});

test('onStart() propagates a failing health check', async () => {
  const mock = makeMockMeilisearch(false);
  const container = makeContainer();
  const plugin = new MeilisearchPlugin(container, mock.createClient);

  await expect(plugin.onStart()).rejects.toThrow('meilisearch unreachable');
});

test('onStop() is a no-op after onStart()', async () => {
  const mock = makeMockMeilisearch();
  const container = makeContainer();
  const plugin = new MeilisearchPlugin(container, mock.createClient);

  await plugin.onStart();

  await expect(plugin.onStop()).resolves.toBeUndefined();
});

test('onStop() is safe when onStart() was never called', async () => {
  const container = makeContainer();
  const plugin = new MeilisearchPlugin(container);

  await expect(plugin.onStop()).resolves.toBeUndefined();
});
