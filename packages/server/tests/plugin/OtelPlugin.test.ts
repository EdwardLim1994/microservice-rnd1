import type { Meter, Tracer } from '@opentelemetry/api';
import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import { OtelPlugin, type OtelPluginConfig } from '../../src/plugin/OtelPlugin';

function makeMockOtel() {
  const state = { shutdownCalled: false };
  const handles = {
    sdk: {
      shutdown: async () => {
        state.shutdownCalled = true;
      },
    },
    tracer: {} as Tracer,
    meter: {} as Meter,
  };
  const createOtel = async (_config: OtelPluginConfig) => handles;
  return { handles, state, createOtel };
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

test('onStart() registers the tracer/meter from the factory into the container', async () => {
  const mock = makeMockOtel();
  const container = makeContainer();
  const plugin = new OtelPlugin(
    container,
    { serviceName: 'test-service' },
    mock.createOtel,
  );

  await plugin.onStart();

  expect(container.resolve('otelTracer')).toBe(mock.handles.tracer);
  expect(container.resolve('otelMeter')).toBe(mock.handles.meter);
});

test('onStop() shuts down the SDK', async () => {
  const mock = makeMockOtel();
  const container = makeContainer();
  const plugin = new OtelPlugin(container, {}, mock.createOtel);

  await plugin.onStart();
  await plugin.onStop();

  expect(mock.state.shutdownCalled).toBe(true);
});

test('onStop() is safe when onStart() was never called', async () => {
  const container = makeContainer();
  const plugin = new OtelPlugin(container);

  await expect(plugin.onStop()).resolves.toBeUndefined();
});
