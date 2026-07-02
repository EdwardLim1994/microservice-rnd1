import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import type { BaseRouter } from '../../src/abstract/BaseRouter';
import { CronDriver } from '../../src/driver/CronDriver';

function makeMockCron() {
  const calls: { schedule: string; handler: () => unknown }[] = [];
  const stopped: (() => unknown)[] = [];

  const createCron = (schedule: string, handler: () => unknown) => {
    calls.push({ schedule, handler });
    return {
      cron: schedule,
      stop: () => {
        stopped.push(handler);
        return undefined as unknown as Bun.CronJob;
      },
      ref: () => undefined as unknown as Bun.CronJob,
      unref: () => undefined as unknown as Bun.CronJob,
    } as unknown as Bun.CronJob;
  };

  return { calls, stopped, createCron };
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

class StubCronRouter {
  schedules = { cleanup: '0 0 * * *' };
  runs = 0;
  dispatchers: Record<string, () => Promise<void>>;

  constructor(private readonly fail = false) {
    this.dispatchers = {
      cleanup: async () => {
        this.runs += 1;
        if (this.fail) throw new Error('boom');
      },
    };
  }

  register() {}
}

const defaultOptions = {
  port: 3000,
  host: '0.0.0.0',
  interceptors: [],
  plugins: [],
};

test('start() ignores routers with no schedules/dispatchers shape', async () => {
  const mock = makeMockCron();
  const driver = new CronDriver({}, mock.createCron);

  await driver.start({
    ...defaultOptions,
    routers: [],
    container: makeContainer(),
  });

  expect(mock.calls).toHaveLength(0);
});

test('start() registers a Bun.cron job per schedule declared by a CronRouter', async () => {
  const mock = makeMockCron();
  const router = new StubCronRouter();
  const driver = new CronDriver({}, mock.createCron);

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    container: makeContainer(),
  });

  expect(mock.calls).toHaveLength(1);
  expect(mock.calls[0].schedule).toBe('0 0 * * *');
});

test('the wrapped handler invokes the router dispatcher', async () => {
  const mock = makeMockCron();
  const router = new StubCronRouter();
  const driver = new CronDriver({}, mock.createCron);

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    container: makeContainer(),
  });

  await mock.calls[0].handler();

  expect(router.runs).toBe(1);
});

test('a dispatcher error is caught and reported via onError instead of throwing', async () => {
  const mock = makeMockCron();
  const router = new StubCronRouter(true);
  const errors: { error: unknown; name: string }[] = [];
  const driver = new CronDriver(
    { onError: (error, name) => errors.push({ error, name }) },
    mock.createCron,
  );

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    container: makeContainer(),
  });

  await expect(mock.calls[0].handler()).resolves.toBeUndefined();
  expect(errors).toEqual([{ error: new Error('boom'), name: 'cleanup' }]);
});

test('stop() stops every job that was started', async () => {
  const mock = makeMockCron();
  const router = new StubCronRouter();
  const driver = new CronDriver({}, mock.createCron);

  await driver.start({
    ...defaultOptions,
    routers: [router as unknown as BaseRouter],
    container: makeContainer(),
  });
  await driver.stop();

  expect(mock.stopped).toHaveLength(1);
});

test('stop() is safe when no job was ever created', async () => {
  const mock = makeMockCron();
  const driver = new CronDriver({}, mock.createCron);

  await driver.start({
    ...defaultOptions,
    routers: [],
    container: makeContainer(),
  });

  await expect(driver.stop()).resolves.toBeUndefined();
});
