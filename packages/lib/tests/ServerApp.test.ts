import { expect, test } from '@rstest/core';
import {
  BaseDriver,
  type DriverStartOptions,
} from '../src/abstract/BaseDriver';
import { BaseInterceptor } from '../src/abstract/BaseInterceptor';
import { BasePlugin } from '../src/abstract/BasePlugin';
import { BaseRouter } from '../src/abstract/BaseRouter';
import { ServerApp } from '../src/ServerApp';

class StubDriver extends BaseDriver {
  calls: DriverStartOptions[] = [];
  stopped = false;

  async start(options: DriverStartOptions) {
    this.calls.push(options);
  }

  async stop() {
    this.stopped = true;
  }
}

class StubRouter extends BaseRouter {
  registered: unknown[] = [];
  register(server: unknown) {
    this.registered.push(server);
  }
}

class StubInterceptor extends BaseInterceptor {
  applied: unknown[] = [];
  apply(server: unknown) {
    this.applied.push(server);
  }
}

class StubPlugin extends BasePlugin {
  started = false;
  stopped = false;
  async onStart() {
    this.started = true;
  }
  async onStop() {
    this.stopped = true;
  }
}

class StubDbAdapter {
  readonly adapter = {};
  async end() {}
}

class StubPrismaClient {
  connected = false;
  disconnected = false;
  constructor(_options: any) {}
  async $connect() {
    this.connected = true;
  }
  async $disconnect() {
    this.disconnected = true;
  }
}

test('init returns a ServerApp instance', () => {
  const app = ServerApp.init(StubDriver);
  expect(app).toBeInstanceOf(ServerApp);
});

test('builder methods return the same instance for chaining', () => {
  const app = ServerApp.init(StubDriver);
  expect(app.routers([])).toBe(app);
  expect(app.interceptors([])).toBe(app);
  expect(app.plugins([])).toBe(app);
  expect(app.database(StubPrismaClient, new StubDbAdapter())).toBe(app);
  expect(app.port(4000)).toBe(app);
  expect(app.host('127.0.0.1')).toBe(app);
});

test('run() calls driver.start with correct port and host', async () => {
  const app = ServerApp.init(StubDriver).port(5000).host('127.0.0.1');
  await app.run();

  const driver = (app as any).driver as StubDriver;
  expect(driver.calls[0]).toMatchObject({ port: 5000, host: '127.0.0.1' });
});

test('run() instantiates routers and passes them to driver', async () => {
  const app = ServerApp.init(StubDriver).routers([StubRouter]);
  await app.run();

  const driver = (app as any).driver as StubDriver;
  expect(driver.calls[0].routers).toHaveLength(1);
  expect(driver.calls[0].routers[0]).toBeInstanceOf(StubRouter);
});

test('run() calls onStart on each plugin before driver.start', async () => {
  const order: string[] = [];

  class OrderedPlugin extends BasePlugin {
    async onStart() {
      order.push('plugin');
    }
    async onStop() {}
  }

  class OrderedDriver extends BaseDriver {
    async start() {
      order.push('driver');
    }
    async stop() {}
  }

  await ServerApp.init(OrderedDriver).plugins([OrderedPlugin]).run();
  expect(order).toEqual(['plugin', 'driver']);
});

test('stop() calls onStop on the same plugin instances started in run()', async () => {
  const instances: StubPlugin[] = [];

  class TrackingPlugin extends BasePlugin {
    constructor(...args: any[]) {
      super();
      instances.push(this as unknown as StubPlugin);
    }
    async onStart() {}
    async onStop() {
      (this as any).stopped = true;
    }
  }

  const app = ServerApp.init(StubDriver).plugins([TrackingPlugin]);
  await app.run();
  await app.stop();

  expect(instances).toHaveLength(1);
  expect((instances[0] as any).stopped).toBe(true);
});

test('run() calls prisma connect when database is set', async () => {
  const app = ServerApp.init(StubDriver).database(
    StubPrismaClient,
    new StubDbAdapter(),
  );
  await app.run();

  const prisma = (app as any).container.resolve('prisma') as StubPrismaClient;
  expect(prisma.connected).toBe(true);
});

test('stop() calls prisma disconnect when database is set', async () => {
  const app = ServerApp.init(StubDriver).database(
    StubPrismaClient,
    new StubDbAdapter(),
  );
  await app.run();
  await app.stop();

  const prisma = (app as any).container.resolve('prisma') as StubPrismaClient;
  expect(prisma.disconnected).toBe(true);
});

test('run() invokes callback with port and host after start', async () => {
  const received: (number | string)[] = [];
  await ServerApp.init(StubDriver)
    .port(9000)
    .host('0.0.0.0')
    .run((port, host) => {
      received.push(port, host);
    });
  expect(received).toEqual([9000, '0.0.0.0']);
});

test('database() registers prisma in container', () => {
  const app = ServerApp.init(StubDriver).database(
    StubPrismaClient,
    new StubDbAdapter(),
  );
  const container = (app as any).container;
  expect(container.resolve('prisma')).toBeInstanceOf(StubPrismaClient);
});
