import { expect, test } from '@rstest/core';
import {
  BaseInterceptor,
  InterceptorError,
  type InterceptorRequest,
} from '../../src/abstract/BaseInterceptor';

function makeMockGrpcServer() {
  const registered: { service: unknown; implementation: any }[] = [];
  return {
    addService(service: unknown, implementation: any) {
      registered.push({ service, implementation });
    },
    registered,
  };
}

function makeCall(headers: Record<string, string> = {}) {
  return {
    metadata: {
      get: (key: string) => (key in headers ? [headers[key]] : []),
    },
  };
}

function flushMicrotasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

// A non-auth interceptor — proves intercept() is a general "run before the call" hook, not just
// something auth-shaped: it never throws, just records what it saw.
class LoggingInterceptor extends BaseInterceptor {
  seen: (string | undefined)[] = [];

  protected intercept(request: InterceptorRequest): void {
    this.seen.push(request.getHeader('x-request-id'));
  }
}

test('a non-throwing interceptor logs and always lets the call through', async () => {
  const server = makeMockGrpcServer();
  const interceptor = new LoggingInterceptor();
  interceptor.apply(server);

  const calls: unknown[] = [];
  const handler = (call: unknown, callback: (error: unknown) => void) => {
    calls.push(call);
    callback(null);
  };
  (server as any).addService({}, { testMethod: handler });

  server.registered[0].implementation.testMethod(
    makeCall({ 'x-request-id': 'req-1' }),
    () => {},
  );
  await flushMicrotasks();

  expect(calls).toHaveLength(1);
  expect(interceptor.seen).toEqual(['req-1']);
});

test('an unexpected (non-InterceptorError) throw still rejects the call, as INTERNAL', async () => {
  class BuggyInterceptor extends BaseInterceptor {
    protected intercept(): void {
      throw new Error('boom');
    }
  }
  const server = makeMockGrpcServer();
  new BuggyInterceptor().apply(server);

  const calls: unknown[] = [];
  const handler = (call: unknown, callback: (error: unknown) => void) => {
    calls.push(call);
    callback(null);
  };
  (server as any).addService({}, { testMethod: handler });

  const results: unknown[] = [];
  server.registered[0].implementation.testMethod(makeCall(), (error: unknown) =>
    results.push(error),
  );
  await flushMicrotasks();

  expect(calls).toHaveLength(0);
  expect(results[0]).toMatchObject({ code: 13, message: 'boom' }); // status.INTERNAL = 13
});

test('InterceptorError rejects as UNAUTHENTICATED', async () => {
  class RejectingInterceptor extends BaseInterceptor {
    protected intercept(): void {
      throw new InterceptorError('nope');
    }
  }
  const server = makeMockGrpcServer();
  new RejectingInterceptor().apply(server);

  const handler = (_call: unknown, callback: (error: unknown) => void) =>
    callback(null);
  (server as any).addService({}, { testMethod: handler });

  const results: unknown[] = [];
  server.registered[0].implementation.testMethod(makeCall(), (error: unknown) =>
    results.push(error),
  );
  await flushMicrotasks();

  expect(results[0]).toMatchObject({ code: 16, message: 'nope' }); // status.UNAUTHENTICATED = 16
});
