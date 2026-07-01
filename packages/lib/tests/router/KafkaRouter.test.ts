import { expect, test } from '@rstest/core';
import { asValue, createContainer, InjectionMode } from 'awilix';
import { BaseUseCase } from '../../src/abstract/BaseUseCase';
import {
  KafkaConsumerRouter,
  type KafkaHandlerMap,
  type KafkaMessageType,
} from '../../src/router/KafkaRouter';

interface Demo1Event {
  id: string;
  name: string;
}

const Demo1EventType: KafkaMessageType<Demo1Event> = {
  decode: (input: Uint8Array) => JSON.parse(new TextDecoder().decode(input)),
};

class LogDemo1EventUseCase extends BaseUseCase<Demo1Event, void> {
  static received: Demo1Event[] = [];
  async execute(input: Demo1Event) {
    LogDemo1EventUseCase.received.push(input);
  }
}

class TestKafkaRouter extends KafkaConsumerRouter<{
  'demo1.events': typeof Demo1EventType;
}> {
  get topics() {
    return { 'demo1.events': Demo1EventType };
  }
  get handlers(): KafkaHandlerMap<{ 'demo1.events': typeof Demo1EventType }> {
    return { 'demo1.events': LogDemo1EventUseCase };
  }
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

test('register() is a no-op', () => {
  const container = makeContainer();
  const router = new TestKafkaRouter(container);
  expect(() => router.register({})).not.toThrow();
});

test('dispatchers getter auto-registers use cases in container', () => {
  const container = makeContainer();
  const router = new TestKafkaRouter(container);

  const _ = router.dispatchers;

  expect(container.hasRegistration('logDemo1EventUseCase')).toBe(true);
});

test('dispatchers getter returns one function per topic', () => {
  const container = makeContainer();
  const router = new TestKafkaRouter(container);
  const dispatchers = router.dispatchers;

  expect(Object.keys(dispatchers)).toEqual(['demo1.events']);
  expect(typeof dispatchers['demo1.events']).toBe('function');
});

test('dispatcher decodes the payload and calls use case execute', async () => {
  const container = makeContainer();
  const router = new TestKafkaRouter(container);
  LogDemo1EventUseCase.received = [];

  const payload = new TextEncoder().encode(
    JSON.stringify({ id: '1', name: 'hello' }),
  );
  await router.dispatchers['demo1.events'](payload);

  expect(LogDemo1EventUseCase.received).toEqual([{ id: '1', name: 'hello' }]);
});

test('dispatchers skips already-registered use cases', () => {
  const container = makeContainer();
  const existingInstance = new LogDemo1EventUseCase();
  container.register({ logDemo1EventUseCase: asValue(existingInstance) });

  const router = new TestKafkaRouter(container);
  const _ = router.dispatchers;

  expect(container.resolve('logDemo1EventUseCase')).toBe(existingInstance);
});
