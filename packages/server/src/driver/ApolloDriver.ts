import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { parse } from 'graphql';
import { BaseDriver, type DriverStartOptions } from '../abstract/BaseDriver';

interface GraphqlRouterShape {
  typeDefs: unknown;
  resolvers: unknown;
}

function isGraphqlRouter(router: unknown): router is GraphqlRouterShape {
  return (
    typeof router === 'object' &&
    router !== null &&
    'typeDefs' in router &&
    'resolvers' in router
  );
}

type StandaloneServerFn = typeof startStandaloneServer;
type BuildSubgraphSchemaFn = typeof buildSubgraphSchema;

export class ApolloDriver extends BaseDriver {
  private _server?: ApolloServer;

  // ponytail: factory params allow injection in tests without module mocking
  constructor(
    private readonly createServer: (options: any) => ApolloServer = (o) =>
      new ApolloServer(o),
    private readonly startServer: StandaloneServerFn = startStandaloneServer,
    private readonly buildSchema: BuildSubgraphSchemaFn = buildSubgraphSchema,
  ) {
    super();
  }

  /** Builds a federation subgraph schema from every GraphQL router's typeDefs/resolvers (skipping non-GraphQL routers via duck-typing), applies interceptors, then starts the standalone server. */
  async start({
    port,
    host,
    routers,
    interceptors,
  }: DriverStartOptions): Promise<void> {
    const modules: { typeDefs: any; resolvers: any }[] = [];

    for (const router of routers) {
      if (!isGraphqlRouter(router)) continue;
      const typeDefs =
        typeof router.typeDefs === 'string'
          ? parse(router.typeDefs)
          : router.typeDefs;
      modules.push({ typeDefs, resolvers: router.resolvers });
    }

    const schema = this.buildSchema(modules as any);
    this._server = this.createServer({ schema });

    for (const interceptor of interceptors) {
      interceptor.apply(this._server);
    }

    await this.startServer(this._server, { listen: { port, host } });
  }

  /** Stops the Apollo server, if it was started. */
  async stop(): Promise<void> {
    await this._server?.stop();
  }
}
