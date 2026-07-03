import { expect, test } from '@rstest/core';
import { GraphQLError } from 'graphql';
import { AuthInterceptor } from '../../src/interceptor/AuthInterceptor';

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

function makeMockApolloServer() {
  const plugins: any[] = [];
  return {
    addPlugin(plugin: unknown) {
      plugins.push(plugin);
    },
    plugins,
  };
}

// intercept() is awaited inside BaseInterceptor's gRPC wrapper, so the real handler only runs
// after a microtask tick even when validateToken is synchronous — tests invoke the wrapped
// handler, then flush microtasks before asserting on its effects.
function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

// validateToken() is overridden via subclassing, not constructor injection — same pattern any
// real integration would use to swap in a real auth service.
class CustomAuthInterceptor extends AuthInterceptor {
  constructor(private readonly accept: (token?: string) => boolean) {
    super();
  }

  protected validateToken(token?: string): boolean {
    return this.accept(token);
  }
}

test('grpc: wraps addService so a valid token passes through to the real handler', async () => {
  process.env.AUTH_TOKEN = 'secret';
  const server = makeMockGrpcServer();
  const interceptor = new AuthInterceptor();
  interceptor.apply(server);

  const { handler, calls } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });

  const results: unknown[] = [];
  const callback = (error: unknown, value?: unknown) =>
    results.push({ error, value });
  server.registered[0].implementation.testMethod(makeCall('secret'), callback);
  await flushMicrotasks();

  expect(calls).toHaveLength(1);
  expect(results[0]).toEqual({ error: null, value: 'ok' });
  delete process.env.AUTH_TOKEN;
});

test('grpc: rejects with UNAUTHENTICATED when the token is missing or wrong', async () => {
  process.env.AUTH_TOKEN = 'secret';
  const server = makeMockGrpcServer();
  const interceptor = new AuthInterceptor();
  interceptor.apply(server);

  const { handler, calls } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });

  const results: unknown[] = [];
  const callback = (error: unknown, value?: unknown) =>
    results.push({ error, value });
  server.registered[0].implementation.testMethod(makeCall('wrong'), callback);
  await flushMicrotasks();

  expect(calls).toHaveLength(0);
  expect(results[0]).toMatchObject({ error: { code: 16 } });
  delete process.env.AUTH_TOKEN;
});

test('grpc: accepts a bearer-prefixed token the same as a raw one', async () => {
  process.env.AUTH_TOKEN = 'secret';
  const server = makeMockGrpcServer();
  const interceptor = new AuthInterceptor();
  interceptor.apply(server);

  const { handler, calls } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });

  server.registered[0].implementation.testMethod(
    makeCall('Bearer secret'),
    () => {},
  );
  await flushMicrotasks();

  expect(calls).toHaveLength(1);
  delete process.env.AUTH_TOKEN;
});

test('grpc: a subclass overriding validateToken() replaces the env-var default', async () => {
  const server = makeMockGrpcServer();
  const interceptor = new CustomAuthInterceptor((token) => token === 'custom');
  interceptor.apply(server);

  const { handler, calls } = makeUnaryHandler();
  (server as any).addService({}, { testMethod: handler });

  server.registered[0].implementation.testMethod(makeCall('custom'), () => {});
  await flushMicrotasks();

  expect(calls).toHaveLength(1);
});

test('grpc: passes streaming handlers (fewer than 2 args) through unwrapped', () => {
  const server = makeMockGrpcServer();
  const interceptor = new AuthInterceptor();
  interceptor.apply(server);

  const streamingHandler = (_call: unknown) => {};
  (server as any).addService({}, { streamMethod: streamingHandler });

  expect(server.registered[0].implementation.streamMethod).toBe(
    streamingHandler,
  );
});

test('apollo: registers a plugin that rejects a missing/invalid token', async () => {
  const server = makeMockApolloServer();
  const interceptor = new CustomAuthInterceptor((token) => token === 'secret');
  interceptor.apply(server as any);

  expect(server.plugins).toHaveLength(1);
  const listener = await server.plugins[0].requestDidStart();

  await expect(
    listener.didResolveOperation({
      request: { http: { headers: new Map() } },
    }),
  ).rejects.toBeInstanceOf(GraphQLError);
});

test('apollo: allows a request with a valid token through', async () => {
  const server = makeMockApolloServer();
  const interceptor = new CustomAuthInterceptor((token) => token === 'secret');
  interceptor.apply(server as any);

  const listener = await server.plugins[0].requestDidStart();
  const headers = new Map([['authorization', 'secret']]);

  await expect(
    listener.didResolveOperation({ request: { http: { headers } } }),
  ).resolves.toBeUndefined();
});

test('apply() is a no-op for an unrecognized server shape', () => {
  const interceptor = new AuthInterceptor();
  expect(() => interceptor.apply({})).not.toThrow();
});
