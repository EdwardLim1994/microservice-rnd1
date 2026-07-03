import { expect, test } from '@rstest/core';
import { asValue, createContainer, InjectionMode } from 'awilix';
import { BaseUseCase } from '../../src/abstract/BaseUseCase';
import type { KafkaSerializer } from '../../src/kafka/KafkaSerializer';
import { KafkaConsumerRouter, type KafkaHandlerMap } from '../../src/router/KafkaRouter';

interface Demo1Event {
  id: string;
  name: string;
}

// A generated-message-shaped stand-in — only its `decode` return type is ever used for
// inference; the function itself is never called (the real decode always goes through the
// container-resolved KafkaSerializer instead).
const demo1EventType = { decode: (_input: Uint8Array) => ({}) as Demo1Event };
const topicTypes = { 'demo1.events': demo1EventType };

class LogDemo1EventUseCase extends BaseUseCase<Demo1Event, void> {
  static received: Demo1Event[] = [];
  async execute(input: Demo1Event) {
    LogDemo1EventUseCase.received.push(input);
  }
}

class TestKafkaRouter extends KafkaConsumerRouter<typeof topicTypes> {
  get topicTypes() {
    return topicTypes;
  }
  get handlers(): KafkaHandlerMap<typeof topicTypes> {
    return { 'demo1.events': LogDemo1EventUseCase };
  }
}

function makeMockSerializer() {
  const calls: { topic: string; payload: Uint8Array }[] = [];
  const serializer: KafkaSerializer = {
    serialize: async () => Buffer.from(''),
    deserialize: async (topic, payload) => {
      calls.push({ topic, payload: payload as Uint8Array });
      return { id: '1', name: 'hello' };
    },
  };
  return { serializer, calls };
}

function makeContainer(serializer: KafkaSerializer) {
  const container = createContainer({ injectionMode: InjectionMode.PROXY });
  container.register({ kafkaSerializer: asValue(serializer) });
  return container;
}

test('register() is a no-op', () => {
  const container = makeContainer(makeMockSerializer().serializer);
  const router = new TestKafkaRouter(container);
  expect(() => router.register({})).not.toThrow();
});

test('topics decodes via the container-resolved kafkaSerializer, bound per topic', async () => {
  const mock = makeMockSerializer();
  const container = makeContainer(mock.serializer);
  const router = new TestKafkaRouter(container);

  const payload = new Uint8Array([1, 2, 3]);
  const result = await router.topics['demo1.events'].decode(payload);

  expect(mock.calls).toEqual([{ topic: 'demo1.events', payload }]);
  expect(result).toEqual({ id: '1', name: 'hello' });
});

test('topics resolves kafkaSerializer lazily — safe even if registered after the router is constructed', async () => {
  const container = createContainer({ injectionMode: InjectionMode.PROXY });
  const router = new TestKafkaRouter(container);

  const mock = makeMockSerializer();
  container.register({ kafkaSerializer: asValue(mock.serializer) });

  await expect(
    router.topics['demo1.events'].decode(new Uint8Array()),
  ).resolves.toEqual({ id: '1', name: 'hello' });
});

test('dispatchers getter auto-registers use cases in container', () => {
  const container = makeContainer(makeMockSerializer().serializer);
  const router = new TestKafkaRouter(container);

  const _ = router.dispatchers;

  expect(container.hasRegistration('logDemo1EventUseCase')).toBe(true);
});

test('dispatchers getter returns one function per topic', () => {
  const container = makeContainer(makeMockSerializer().serializer);
  const router = new TestKafkaRouter(container);
  const dispatchers = router.dispatchers;

  expect(Object.keys(dispatchers)).toEqual(['demo1.events']);
  expect(typeof dispatchers['demo1.events']).toBe('function');
});

test('dispatcher decodes the payload (via kafkaSerializer) and calls use case execute', async () => {
  const container = makeContainer(makeMockSerializer().serializer);
  const router = new TestKafkaRouter(container);
  LogDemo1EventUseCase.received = [];

  await router.dispatchers['demo1.events'](new Uint8Array([1, 2, 3]));

  expect(LogDemo1EventUseCase.received).toEqual([{ id: '1', name: 'hello' }]);
});

test('dispatchers skips already-registered use cases', () => {
  const container = makeContainer(makeMockSerializer().serializer);
  const existingInstance = new LogDemo1EventUseCase();
  container.register({ logDemo1EventUseCase: asValue(existingInstance) });

  const router = new TestKafkaRouter(container);
  const _ = router.dispatchers;

  expect(container.resolve('logDemo1EventUseCase')).toBe(existingInstance);
});
