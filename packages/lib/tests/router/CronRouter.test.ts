import { expect, test } from '@rstest/core';
import { asValue, createContainer, InjectionMode } from 'awilix';
import { BaseUseCase } from '../../src/abstract/BaseUseCase';
import {
  CronRouter,
  type CronHandlerMap,
  type CronScheduleMap,
} from '../../src/router/CronRouter';

class CleanupUseCase extends BaseUseCase<void, void> {
  static runs = 0;
  async execute() {
    CleanupUseCase.runs += 1;
  }
}

const schedules = { cleanup: '0 0 * * *' } satisfies CronScheduleMap;

class TestCronRouter extends CronRouter<typeof schedules> {
  get schedules() {
    return schedules;
  }
  get handlers(): CronHandlerMap<typeof schedules> {
    return { cleanup: CleanupUseCase };
  }
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

test('register() is a no-op', () => {
  const container = makeContainer();
  const router = new TestCronRouter(container);
  expect(() => router.register({})).not.toThrow();
});

test('dispatchers getter auto-registers use cases in container', () => {
  const container = makeContainer();
  const router = new TestCronRouter(container);

  const _ = router.dispatchers;

  expect(container.hasRegistration('cleanupUseCase')).toBe(true);
});

test('dispatchers getter returns one function per schedule', () => {
  const container = makeContainer();
  const router = new TestCronRouter(container);
  const dispatchers = router.dispatchers;

  expect(Object.keys(dispatchers)).toEqual(['cleanup']);
  expect(typeof dispatchers.cleanup).toBe('function');
});

test('dispatcher resolves the use case and calls execute', async () => {
  const container = makeContainer();
  const router = new TestCronRouter(container);
  CleanupUseCase.runs = 0;

  await router.dispatchers.cleanup();

  expect(CleanupUseCase.runs).toBe(1);
});

test('dispatchers skips already-registered use cases', () => {
  const container = makeContainer();
  const existingInstance = new CleanupUseCase();
  container.register({ cleanupUseCase: asValue(existingInstance) });

  const router = new TestCronRouter(container);
  const _ = router.dispatchers;

  expect(container.resolve('cleanupUseCase')).toBe(existingInstance);
});
