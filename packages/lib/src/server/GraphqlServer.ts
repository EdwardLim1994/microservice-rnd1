import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { buildSubgraphSchema } from '@apollo/subgraph';
import type { GraphqlRouter } from '../router/';
import { BaseServer } from '../shared';

type GraphqlServerType = {
	port: number;
	host?: string;
	name?: string;
	federation?: boolean;
};

export default class GraphqlServer extends BaseServer {
	private callback?: () => void;
	private controller?: GraphqlRouter;
	private readonly federation: boolean;
	constructor({ port, host, name, federation }: GraphqlServerType) {
		super();

		this.port = port;

		if (host) this.host = host;

		if (name) this.name = name;

		this.federation = federation ?? false;
	}

	public withCallback(callback: () => void): this {
		this.callback = callback;
		return this;
	}

	public withController(controller: GraphqlRouter): this {
		this.controller = controller;
		return this;
	}

	public override async run(): Promise<void> {
		if (!this.controller) throw new Error('GraphqlRouter is required');

		const { typeDefs, resolvers } = this.controller.register();
		const schema = this.federation
			? {
					schema: buildSubgraphSchema({
						typeDefs,
						resolvers: resolvers as any,
					}),
					graphqlEndpoint: `/graphql`,
					introspection: true,
				}
			: { typeDefs, resolvers };

		const server = new ApolloServer(schema);
		const { url } = await startStandaloneServer(server, {
			listen: {
				port: this.port,
				host: this.host,
			},
		});

		if (this.callback) {
			this.callback();
		} else {
			console.info(`GraphQL Server running at ${url}`);
		}
	}
}
