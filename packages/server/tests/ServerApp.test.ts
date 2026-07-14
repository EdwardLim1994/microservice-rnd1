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

class OtherStubDriver extends BaseDriver {
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

function getDriverInstance<TDriver extends BaseDriver>(
  app: ServerApp,
  index = 0,
): TDriver {
  const internals = app as unknown as {
    runningDrivers: { driver: TDriver }[];
  };
  return internals.runningDrivers[index].driver;
}

test('init returns a ServerApp instance', () => {
  const app = ServerApp.init([StubDriver]);
  expect(app).toBeInstanceOf(ServerApp);
});

test('builder methods return the same instance for chaining', () => {
  const app = ServerApp.init([StubDriver]);
  expect(app.routers([])).toBe(app);
  expect(app.interceptors([])).toBe(app);
  expect(app.plugins([])).toBe(app);
  expect(app.database(StubPrismaClient, new StubDbAdapter())).toBe(app);
  expect(app.port(4000)).toBe(app);
  expect(app.host('127.0.0.1')).toBe(app);
});

test('run() calls driver.start with correct port and host', async () => {
  const app = ServerApp.init([StubDriver]).port(5000).host('127.0.0.1');
  await app.run();

  const driver = getDriverInstance<StubDriver>(app);
  expect(driver.calls[0]).toMatchObject({ port: 5000, host: '127.0.0.1' });
});

test('init() accepts a single bare driver and uses port()/host() for it', async () => {
  const app = ServerApp.init(StubDriver).port(5000).host('127.0.0.1');
  await app.run();

  const driver = getDriverInstance<StubDriver>(app);
  expect(driver.calls[0]).toMatchObject({ port: 5000, host: '127.0.0.1' });
});

test('run() instantiates routers and passes them to driver', async () => {
  const app = ServerApp.init([StubDriver]).routers([StubRouter]);
  await app.run();

  const driver = getDriverInstance<StubDriver>(app);
  expect(driver.calls[0].routers).toHaveLength(1);
  expect(driver.calls[0].routers[0]).toBeInstanceOf(StubRouter);
});

test('run() starts multiple drivers, each with its own port/host', async () => {
  const app = ServerApp.init([
    { driver: StubDriver, port: 5001, host: '0.0.0.0' },
    { driver: OtherStubDriver, port: 4001 },
  ]).host('127.0.0.1');
  await app.run();

  const grpc = getDriverInstance<StubDriver>(app, 0);
  const graphql = getDriverInstance<OtherStubDriver>(app, 1);

  expect(grpc.calls[0]).toMatchObject({ port: 5001, host: '0.0.0.0' });
  expect(graphql.calls[0]).toMatchObject({ port: 4001, host: '127.0.0.1' });
});

test('run() and stop() start/stop every driver', async () => {
  const app = ServerApp.init([StubDriver, OtherStubDriver]);
  await app.run();

  const first = getDriverInstance<StubDriver>(app, 0);
  const second = getDriverInstance<OtherStubDriver>(app, 1);
  expect(first.calls).toHaveLength(1);
  expect(second.calls).toHaveLength(1);

  await app.stop();
  expect(first.stopped).toBe(true);
  expect(second.stopped).toBe(true);
});

test('run() calls onStart on each plugin before any driver.start', async () => {
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

  await ServerApp.init([OrderedDriver]).plugins([OrderedPlugin]).run();
  expect(order).toEqual(['plugin', 'driver']);
});

test('stop() calls onStop on the same plugin instances started in run()', async () => {
  const instances: StubPlugin[] = [];

  class TrackingPlugin extends BasePlugin {
    constructor(..._args: any[]) {
      super();
      instances.push(this as unknown as StubPlugin);
    }
    async onStart() {}
    async onStop() {
      (this as any).stopped = true;
    }
  }

  const app = ServerApp.init([StubDriver]).plugins([TrackingPlugin]);
  await app.run();
  await app.stop();

  expect(instances).toHaveLength(1);
  expect((instances[0] as any).stopped).toBe(true);
});

test('run() calls prisma connect when database is set', async () => {
  const app = ServerApp.init([StubDriver]).database(
    StubPrismaClient,
    new StubDbAdapter(),
  );
  await app.run();

  const prisma = (app as any).container.resolve('prisma') as StubPrismaClient;
  expect(prisma.connected).toBe(true);
});

test('stop() calls prisma disconnect when database is set', async () => {
  const app = ServerApp.init([StubDriver]).database(
    StubPrismaClient,
    new StubDbAdapter(),
  );
  await app.run();
  await app.stop();

  const prisma = (app as any).container.resolve('prisma') as StubPrismaClient;
  expect(prisma.disconnected).toBe(true);
});

test('run() invokes callback once per driver with driver name, port and host', async () => {
  const received: { driver: string; port?: number; host?: string }[] = [];
  await ServerApp.init([
    { driver: StubDriver, port: 9000 },
    { driver: OtherStubDriver, port: 9001 },
  ])
    .host('0.0.0.0')
    .run((info) => {
      received.push(info);
    });

  expect(received).toContainEqual({
    driver: 'StubDriver',
    port: 9000,
    host: '0.0.0.0',
  });
  expect(received).toContainEqual({
    driver: 'OtherStubDriver',
    port: 9001,
    host: '0.0.0.0',
  });
});

test("run() calls a driver entry's onReady in addition to the shared callback", async () => {
  const events: string[] = [];

  await ServerApp.init([
    {
      driver: StubDriver,
      port: 9000,
      onReady: (info) => events.push(`onReady:${info.driver}:${info.port}`),
    },
    { driver: OtherStubDriver, port: 9001 },
  ]).run((info) => events.push(`callback:${info.driver}:${info.port}`));

  expect(events).toContain('onReady:StubDriver:9000');
  expect(events).toContain('callback:StubDriver:9000');
  expect(events).toContain('callback:OtherStubDriver:9001');
  expect(events).not.toContain('onReady:OtherStubDriver:9001');
});

test('run() passes the ServerApp container to driver.start', async () => {
  const app = ServerApp.init([StubDriver]);
  await app.run();

  const driver = getDriverInstance<StubDriver>(app);
  const container = (app as any).container;
  expect(driver.calls[0].container).toBe(container);
});

test("init() passes a driver entry's config as the constructor argument", () => {
  class ConfigurableDriver extends BaseDriver {
    constructor(public readonly config?: { groupId: string }) {
      super();
    }
    async start() {}
    async stop() {}
  }

  const app = ServerApp.init([
    { driver: ConfigurableDriver, config: { groupId: 'my-group' } },
  ]);

  const driver = getDriverInstance<ConfigurableDriver>(app);
  expect(driver.config).toEqual({ groupId: 'my-group' });
});

test("init() without config still uses a driver's own constructor defaults", () => {
  class DefaultingDriver extends BaseDriver {
    constructor(public readonly value: string = 'default') {
      super();
    }
    async start() {}
    async stop() {}
  }

  const app = ServerApp.init([DefaultingDriver]);
  const driver = getDriverInstance<DefaultingDriver>(app);
  expect(driver.value).toBe('default');
});

test('run() resolves a sync database() adapter and registers prisma in container', async () => {
  const app = ServerApp.init([StubDriver]).database(
    StubPrismaClient,
    new StubDbAdapter(),
  );
  await app.run();
  const container = (app as any).container;
  expect(container.resolve('prisma')).toBeInstanceOf(StubPrismaClient);
});

test('run() awaits an async database() factory before registering prisma', async () => {
  let factoryCalled = false;
  const app = ServerApp.init([StubDriver]).database(
    StubPrismaClient,
    async () => {
      factoryCalled = true;
      return new StubDbAdapter();
    },
  );
  await app.run();

  expect(factoryCalled).toBe(true);
  const container = (app as any).container;
  expect(container.resolve('prisma')).toBeInstanceOf(StubPrismaClient);
});

test('run() resolves database() before any plugin onStart or driver start', async () => {
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

  await ServerApp.init([OrderedDriver])
    .database(StubPrismaClient, async () => {
      order.push('database');
      return new StubDbAdapter();
    })
    .plugins([OrderedPlugin])
    .run();

  expect(order).toEqual(['database', 'plugin', 'driver']);
});
