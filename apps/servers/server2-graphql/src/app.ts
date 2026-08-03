import {
	ApolloDriver,
	HealthCheckPlugin,
	MeilisearchPlugin,
	OtelPlugin,
	ServerApp,
	singleton,
} from "server";
import Item2GrpcClient from "./clients/Item2GrpcClient";
import Item2GraphqlRouter from "./routers/Item2GraphqlRouter";

export default async function main() {
	await ServerApp.init([
		{
			driver: ApolloDriver,
			port: Number(import.meta.env.GRAPHQL_PORT),
			onReady: ({ host, port }) =>
				console.log(`GraphQL server is running on ${host}:${port}`),
		},
	])
		.plugins([HealthCheckPlugin, MeilisearchPlugin, OtelPlugin])
		.containers({
			item2GrpcClient: singleton(Item2GrpcClient),
		})
		.routers([Item2GraphqlRouter])
		.run(() => `Server is running`);
}
