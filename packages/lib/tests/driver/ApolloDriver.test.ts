import { expect, test } from '@rstest/core';
import type { ApolloServer } from '@apollo/server';
import { BaseRouter } from '../../src/abstract/BaseRouter';
import { ApolloDriver } from '../../src/driver/ApolloDriver';

function makeMockApollo() {
  const instances: { options: unknown; stopped: boolean }[] = [];

  const createServer = (options: unknown) => {
    const instance = {
      options,
      stopped: false,
      stop: async () => {
        instance.stopped = true;
      },
    };
    instances.push(instance);
    return instance as unknown as ApolloServer;
  };

  const startCalls: { server: unknown; options: unknown }[] = [];
  const startServer = async (server: unknown, options: unknown) => {
    startCalls.push({ server, options });
    return { url: 'http://localhost:4000' };
  };

  return { createServer, startServer, instances, startCalls };
}

class GraphqlStubRouter extends BaseRouter {
  typeDefs = 'type Query { hello: String }';
  resolvers = { Query: { hello: () => 'world' } };
  register() {}
}

class PlainRouter extends BaseRouter {
  register() {}
}

const defaultOptions = {
  port: 4000,
  host: '0.0.0.0',
  routers: [] as BaseRouter[],
  interceptors: [],
  plugins: [],
};

test('start() passes typeDefs and resolvers from graphql routers', async () => {
  const mock = makeMockApollo();
  const router = new GraphqlStubRouter({});
  const driver = new ApolloDriver(mock.createServer, mock.startServer as any);
  await driver.start({ ...defaultOptions, routers: [router] });

  expect(mock.instances[0].options).toMatchObject({
    typeDefs: [router.typeDefs],
    resolvers: [router.resolvers],
  });
});

test('start() skips routers without typeDefs/resolvers', async () => {
  const mock = makeMockApollo();
  const driver = new ApolloDriver(mock.createServer, mock.startServer as any);
  await driver.start({ ...defaultOptions, routers: [new PlainRouter({})] });

  expect(mock.instances[0].options).toMatchObject({
    typeDefs: [],
    resolvers: [],
  });
});

test('start() calls startServer with correct listen options', async () => {
  const mock = makeMockApollo();
  const driver = new ApolloDriver(mock.createServer, mock.startServer as any);
  await driver.start(defaultOptions);

  expect(mock.startCalls[0].options).toEqual({
    listen: { port: 4000, host: '0.0.0.0' },
  });
});

test('stop() calls server.stop()', async () => {
  const mock = makeMockApollo();
  const driver = new ApolloDriver(mock.createServer, mock.startServer as any);
  await driver.start(defaultOptions);
  await driver.stop();
  expect(mock.instances[0].stopped).toBe(true);
});
