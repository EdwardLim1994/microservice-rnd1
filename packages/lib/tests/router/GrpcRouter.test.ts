import { expect, test } from '@rstest/core';
import { InjectionMode, asValue, createContainer } from 'awilix';
import { BaseUseCase } from '../../src/abstract/BaseUseCase';
import { GrpcRouter, type GrpcHandlerMap } from '../../src/router/GrpcRouter';

interface FakeService {
  greet: (call: any, callback: any) => void;
}

class GreetUseCase extends BaseUseCase<{ name: string }, { message: string }> {
  async execute(input: { name: string }) {
    return { message: `Hello ${input.name}` };
  }
}

const fakeServiceDef = { greet: {} };

class TestRouter extends GrpcRouter<FakeService> {
  get service() {
    return fakeServiceDef as any;
  }
  get handlers(): GrpcHandlerMap<FakeService> {
    return { greet: GreetUseCase } as any;
  }
}

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

function makeGrpcServer() {
  const services: { def: unknown; impl: Record<string, Function> }[] = [];
  return {
    addService(def: unknown, impl: Record<string, Function>) {
      services.push({ def, impl });
    },
    services,
  };
}

test('register() calls addService on the grpc server', () => {
  const container = makeContainer();
  const server = makeGrpcServer();
  const router = new TestRouter(container);

  router.register(server);

  expect(server.services).toHaveLength(1);
  expect(server.services[0].def).toBe(fakeServiceDef);
});

test('register() auto-registers use cases into the container', () => {
  const container = makeContainer();
  const server = makeGrpcServer();
  const router = new TestRouter(container);

  router.register(server);

  expect(container.hasRegistration('greetUseCase')).toBe(true);
});

test('grpc handler resolves use case and calls execute with request', async () => {
  const container = makeContainer();
  const server = makeGrpcServer();
  const router = new TestRouter(container);

  router.register(server);

  const handler = server.services[0].impl.greet;
  const call = { request: { name: 'World' } };
  let result: unknown;
  await handler(call, (_err: unknown, res: unknown) => {
    result = res;
  });

  expect(result).toEqual({ message: 'Hello World' });
});

test('grpc handler passes error to callback on use case failure', async () => {
  class FailUseCase extends BaseUseCase<any, any> {
    async execute() {
      throw new Error('boom');
    }
  }

  class FailRouter extends GrpcRouter<FakeService> {
    get service() {
      return fakeServiceDef as any;
    }
    get handlers(): GrpcHandlerMap<FakeService> {
      return { greet: FailUseCase } as any;
    }
  }

  const container = makeContainer();
  const server = makeGrpcServer();
  new FailRouter(container).register(server);

  const handler = server.services[0].impl.greet;
  let caughtErr: unknown;
  await handler({ request: {} }, (err: unknown) => {
    caughtErr = err;
  });

  expect((caughtErr as Error).message).toBe('boom');
});

test('register() skips already-registered use cases', () => {
  const container = makeContainer();
  const existingInstance = new GreetUseCase();
  container.register({ greetUseCase: asValue(existingInstance) });

  const server = makeGrpcServer();
  new TestRouter(container).register(server);

  expect(container.resolve('greetUseCase')).toBe(existingInstance);
});
