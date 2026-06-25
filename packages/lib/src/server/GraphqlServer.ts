import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph"
import type { GraphqlController } from "../controllers/";
import { BaseServer } from "../shared";

type GraphqlServerType = {
	port: number;
	host?: string;
	name?: string;
	federation?: boolean;
};

export default class GraphqlServer extends BaseServer {
	private callback?: () => void;
	private controller?: GraphqlController;
	private federation: boolean = false;
	constructor({ port, host, name, federation }: GraphqlServerType) {
		super();

		this.port = port;

		if (host) this.host = host;

		if (name) this.name = name;

		if (federation) this.federation = federation;
	}

	public withCallback(callback: () => void) {
		this.callback = callback;
		return this;
	}

	public withController(controller: GraphqlController) {
		this.controller = controller;
		return this;
	}

	public async run() {
		if (!this.controller) throw new Error("GraphqlController is required");

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
        host: this.host
      },
		})

    if (this.callback) {
      this.callback();
    } else {
      console.info(`Server running at ${url}`);
		}
	}
}
