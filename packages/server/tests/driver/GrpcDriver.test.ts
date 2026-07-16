import type { Server } from '@grpc/grpc-js';
import { expect, test } from '@rstest/core';
import { BaseRouter } from '../../src/abstract/BaseRouter';
import { GrpcDriver } from '../../src/driver/GrpcDriver';

function makeMockServer() {
  let boundAddress = '';
  let shutdown = false;
  let boundCredentials: unknown;

  return {
    boundAddress: () => boundAddress,
    boundCredentials: () => boundCredentials,
    isShutdown: () => shutdown,
    addService: () => {},
    bindAsync(
      addr: string,
      creds: unknown,
      cb: (err: null, port: number) => void,
    ) {
      boundAddress = addr;
      boundCredentials = creds;
      cb(null, 3000);
    },
    tryShutdown(cb: (err?: Error) => void) {
      shutdown = true;
      cb();
    },
  } as unknown as Server & {
    boundAddress(): string;
    boundCredentials(): unknown;
    isShutdown(): boolean;
  };
}

class StubRouter extends BaseRouter {
  lastServer: unknown = null;
  register(server: unknown) {
    this.lastServer = server;
  }
}

// e.g. a CronRouter/KafkaConsumerRouter/GraphqlRouter passed alongside gRPC routers on a
// multi-driver ServerApp — GrpcDriver must skip it rather than throw on a missing register().
class NonRegistrableStubRouter extends BaseRouter {}

test('start() binds to correct address', async () => {
  const mock = makeMockServer();
  const driver = new GrpcDriver({}, mock);
  await driver.start({
    port: 3000,
    host: '0.0.0.0',
    routers: [],
    interceptors: [],
    plugins: [],
  });
  expect(mock.boundAddress()).toBe('0.0.0.0:3000');
});

test('start() binds insecurely when no tls config is given', async () => {
  const mock = makeMockServer();
  const driver = new GrpcDriver({}, mock);
  await driver.start({
    port: 3000,
    host: '0.0.0.0',
    routers: [],
    interceptors: [],
    plugins: [],
  });
  expect(
    (mock.boundCredentials() as { _isSecure(): boolean })._isSecure(),
  ).toBe(false);
});

test('start() binds with mTLS when a tls config is given', async () => {
  const mock = makeMockServer();
  const tls = {
    ca: Buffer.from('ca'),
    cert: Buffer.from('cert'),
    key: Buffer.from('key'),
  };
  const driver = new GrpcDriver({ tls }, mock);
  await driver.start({
    port: 3000,
    host: '0.0.0.0',
    routers: [],
    interceptors: [],
    plugins: [],
  });
  expect(
    (mock.boundCredentials() as { _isSecure(): boolean })._isSecure(),
  ).toBe(true);
});

test('start() calls register on each router with the grpc server', async () => {
  const mock = makeMockServer();
  const router = new StubRouter({});
  const driver = new GrpcDriver({}, mock);
  await driver.start({
    port: 3000,
    host: '0.0.0.0',
    routers: [router],
    interceptors: [],
    plugins: [],
  });
  expect(router.lastServer).toBe(mock);
});

test('start() skips a router that does not implement Registrable', async () => {
  const mock = makeMockServer();
  const driver = new GrpcDriver({}, mock);
  await expect(
    driver.start({
      port: 3000,
      host: '0.0.0.0',
      routers: [new NonRegistrableStubRouter()],
      interceptors: [],
      plugins: [],
    }),
  ).resolves.toBeUndefined();
});

test('stop() calls tryShutdown on the server', async () => {
  const mock = makeMockServer();
  const driver = new GrpcDriver({}, mock);
  await driver.start({
    port: 3000,
    host: '0.0.0.0',
    routers: [],
    interceptors: [],
    plugins: [],
  });
  await driver.stop();
  expect(mock.isShutdown()).toBe(true);
});

test('start() rejects when bindAsync errors', async () => {
  const errServer = {
    bindAsync(_addr: string, _creds: unknown, cb: (err: Error) => void) {
      cb(new Error('bind failed'));
    },
    tryShutdown: () => {},
  } as unknown as Server;

  const driver = new GrpcDriver({}, errServer);
  await expect(
    driver.start({
      port: 3000,
      host: '0.0.0.0',
      routers: [],
      interceptors: [],
      plugins: [],
    }),
  ).rejects.toThrow('bind failed');
});
