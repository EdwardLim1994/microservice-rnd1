import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
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

export class ApolloDriver extends BaseDriver {
  private _server?: ApolloServer;

  // ponytail: factory params allow injection in tests without module mocking
  constructor(
    private readonly createServer: (options: any) => ApolloServer = (o) =>
      new ApolloServer(o),
    private readonly startServer: StandaloneServerFn = startStandaloneServer,
  ) {
    super();
  }

  async start({
    port,
    host,
    routers,
    interceptors,
  }: DriverStartOptions): Promise<void> {
    const typeDefs: unknown[] = [];
    const resolvers: unknown[] = [];

    for (const router of routers) {
      if (!isGraphqlRouter(router)) continue;
      typeDefs.push(router.typeDefs);
      resolvers.push(router.resolvers);
    }

    this._server = this.createServer({ typeDefs: typeDefs as any, resolvers });

    for (const interceptor of interceptors) {
      interceptor.apply(this._server);
    }

    await this.startServer(this._server, { listen: { port, host } });
  }

  async stop(): Promise<void> {
    await this._server?.stop();
  }
}
