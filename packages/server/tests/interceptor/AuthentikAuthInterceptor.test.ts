import { expect, test } from '@rstest/core';
import { AuthentikAuthInterceptor } from '../../src/interceptor/AuthentikAuthInterceptor';

function makeMockGrpcServer() {
  const registered: { service: unknown; implementation: any }[] = [];
  return {
    addService(service: unknown, implementation: any) {
      registered.push({ service, implementation });
    },
    registered,
  };
}

function makeUnaryHandler() {
  const calls: unknown[] = [];
  const handler = (
    call: unknown,
    callback: (error: unknown, value?: unknown) => void,
  ) => {
    calls.push(call);
    callback(null, 'ok');
  };
  return { handler, calls };
}

function makeCall(token?: string) {
  return {
    metadata: {
      get: (key: string) =>
        key === 'authorization' && token !== undefined ? [token] : [],
    },
  };
}

// intercept() is awaited inside BaseInterceptor's gRPC wrapper — flush a microtask tick before
// asserting on its effects, same helper as AuthInterceptor.test.ts.
function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('rejects when AUTHENTIK_URL is unset', () => {
  delete process.env.AUTHENTIK_URL;
  expect(() => new AuthentikAuthInterceptor()).toThrow(/AUTHENTIK_URL/);
});

test('grpc: a valid token (per the injected verify) passes through to the real handler', async () => {
  process.env.AUTHENTIK_URL = 'http://authentik-server:9000';
  const server = makeMockGrpcServer();
  const verify = async () => ({
    payload: {},
    protectedHeader: {},
    key: undefined as never,
  });
  const interceptor = new AuthentikAuthInterceptor(undefined, verify as any);
  interceptor.apply(server);

  const { handler, calls } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });

  const results: unknown[] = [];
  const callback = (error: unknown, value?: unknown) =>
    results.push({ error, value });
  server.registered[0].implementation.testMethod(
    makeCall('Bearer good-token'),
    callback,
  );
  await flushMicrotasks();

  expect(calls).toHaveLength(1);
  expect(results[0]).toEqual({ error: null, value: 'ok' });
  delete process.env.AUTHENTIK_URL;
});

test('grpc: rejects with UNAUTHENTICATED when verification throws (expired/invalid/wrong signature)', async () => {
  process.env.AUTHENTIK_URL = 'http://authentik-server:9000';
  const server = makeMockGrpcServer();
  const verify = async () => {
    throw new Error('signature verification failed');
  };
  const interceptor = new AuthentikAuthInterceptor(undefined, verify as any);
  interceptor.apply(server);

  const { handler, calls } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });

  const results: unknown[] = [];
  const callback = (error: unknown, value?: unknown) =>
    results.push({ error, value });
  server.registered[0].implementation.testMethod(
    makeCall('Bearer bad-token'),
    callback,
  );
  await flushMicrotasks();

  expect(calls).toHaveLength(0);
  expect(results[0]).toMatchObject({ error: { code: 16 } });
  delete process.env.AUTHENTIK_URL;
});

test('grpc: rejects when no token is present at all', async () => {
  process.env.AUTHENTIK_URL = 'http://authentik-server:9000';
  const server = makeMockGrpcServer();
  const verify = async () => ({
    payload: {},
    protectedHeader: {},
    key: undefined as never,
  });
  const interceptor = new AuthentikAuthInterceptor(undefined, verify as any);
  interceptor.apply(server);

  const { handler, calls } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });

  const results: unknown[] = [];
  const callback = (error: unknown, value?: unknown) =>
    results.push({ error, value });
  server.registered[0].implementation.testMethod(makeCall(undefined), callback);
  await flushMicrotasks();

  expect(calls).toHaveLength(0);
  expect(results[0]).toMatchObject({ error: { code: 16 } });
  delete process.env.AUTHENTIK_URL;
});

test('verify is called with the issuer derived from AUTHENTIK_URL/AUTHENTIK_APPLICATION_SLUG, and no audience by default', async () => {
  process.env.AUTHENTIK_URL = 'http://authentik-server:9000';
  process.env.AUTHENTIK_APPLICATION_SLUG = 'auth';
  const calls: unknown[] = [];
  const verify = async (token: string, _jwks: unknown, options: unknown) => {
    calls.push({ token, options });
    return { payload: {}, protectedHeader: {}, key: undefined as never };
  };
  const interceptor = new AuthentikAuthInterceptor(undefined, verify as any);
  const server = makeMockGrpcServer();
  interceptor.apply(server);
  const { handler } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });
  server.registered[0].implementation.testMethod(
    makeCall('Bearer some-token'),
    () => {},
  );
  await flushMicrotasks();

  expect(calls).toEqual([
    {
      token: 'some-token',
      options: { issuer: 'http://authentik-server:9000/application/o/auth/' },
    },
  ]);
  delete process.env.AUTHENTIK_URL;
  delete process.env.AUTHENTIK_APPLICATION_SLUG;
});

test('sets audience in verify options when AUTHENTIK_JWT_AUDIENCE is configured', async () => {
  process.env.AUTHENTIK_URL = 'http://authentik-server:9000';
  process.env.AUTHENTIK_JWT_AUDIENCE = 'expected-client-id';
  const calls: unknown[] = [];
  const verify = async (token: string, _jwks: unknown, options: unknown) => {
    calls.push(options);
    return { payload: {}, protectedHeader: {}, key: undefined as never };
  };
  const interceptor = new AuthentikAuthInterceptor(undefined, verify as any);
  const server = makeMockGrpcServer();
  interceptor.apply(server);
  const { handler } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });
  server.registered[0].implementation.testMethod(
    makeCall('token-without-bearer-prefix'),
    () => {},
  );
  await flushMicrotasks();

  expect(calls[0]).toMatchObject({ audience: 'expected-client-id' });
  delete process.env.AUTHENTIK_URL;
  delete process.env.AUTHENTIK_JWT_AUDIENCE;
});
