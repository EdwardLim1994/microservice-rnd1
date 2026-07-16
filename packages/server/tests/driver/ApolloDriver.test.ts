import type { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expect, test } from '@rstest/core';
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

  const buildSchemaCalls: unknown[] = [];
  const stubSchema = { stub: true };
  const buildSchema = (modules: unknown) => {
    buildSchemaCalls.push(modules);
    return stubSchema as any;
  };

  return {
    createServer,
    startServer,
    buildSchema,
    stubSchema,
    instances,
    startCalls,
    buildSchemaCalls,
  };
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

test('start() builds a subgraph schema from graphql routers and passes it to the server', async () => {
  const mock = makeMockApollo();
  const router = new GraphqlStubRouter({});
  const driver = new ApolloDriver(
    {},
    mock.createServer,
    mock.startServer as any,
    mock.buildSchema as any,
  );
  await driver.start({ ...defaultOptions, routers: [router] });

  expect(mock.buildSchemaCalls[0]).toMatchObject([
    { resolvers: router.resolvers },
  ]);
  expect(mock.instances[0].options).toMatchObject({ schema: mock.stubSchema });
});

test('start() skips routers without typeDefs/resolvers', async () => {
  const mock = makeMockApollo();
  const driver = new ApolloDriver(
    {},
    mock.createServer,
    mock.startServer as any,
    mock.buildSchema as any,
  );
  await driver.start({ ...defaultOptions, routers: [new PlainRouter({})] });

  expect(mock.buildSchemaCalls[0]).toEqual([]);
});

test('start() calls startServer with correct listen options', async () => {
  const mock = makeMockApollo();
  const driver = new ApolloDriver(
    {},
    mock.createServer,
    mock.startServer as any,
    mock.buildSchema as any,
  );
  await driver.start(defaultOptions);

  expect(mock.startCalls[0].options).toEqual({
    listen: { port: 4000, host: '0.0.0.0', tls: undefined },
  });
});

test('stop() calls server.stop()', async () => {
  const mock = makeMockApollo();
  const driver = new ApolloDriver(
    {},
    mock.createServer,
    mock.startServer as any,
    mock.buildSchema as any,
  );
  await driver.start(defaultOptions);
  await driver.stop();
  expect(mock.instances[0].stopped).toBe(true);
});

test('start() builds a real federation subgraph schema with @key directives', async () => {
  const mock = makeMockApollo();
  class FederatedRouter extends BaseRouter {
    typeDefs = `
      type Query { demo1: Demo1 }
      type Demo1 @key(fields: "id") { id: ID! name: String! }
    `;
    resolvers = {
      Query: { demo1: () => ({ id: '1', name: 'test' }) },
      Demo1: { __resolveReference: (ref: { id: string }) => ref },
    };
    register() {}
  }
  const driver = new ApolloDriver(
    {},
    mock.createServer,
    mock.startServer as any,
    buildSubgraphSchema,
  );

  await driver.start({
    ...defaultOptions,
    routers: [new FederatedRouter({})],
  });

  const schema = (mock.instances[0].options as { schema: unknown }).schema;
  expect(schema).toBeDefined();
});
