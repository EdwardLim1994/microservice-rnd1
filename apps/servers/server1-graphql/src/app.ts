import { ApolloDriver, HealthCheckPlugin, OtelPlugin, ServerApp, singleton } from "server";
import ItemGrpcClient from "./clients/ItemGrpcClient";
import ItemGraphqlRouter from "./routers/ItemGraphqlRouter";

export default async function main() {
	await ServerApp.init([
		{
			driver: ApolloDriver,
			port: Number(import.meta.env.GRAPHQL_PORT),
			onReady: ({ host, port }) =>
				console.log(`GraphQL server is running on ${host}:${port}`),
		},
	])
		.plugins([HealthCheckPlugin, OtelPlugin])
		.containers({ itemGrpcClient: singleton(ItemGrpcClient) })
		.routers([ItemGraphqlRouter])
		.run(() => `Server is running`);
}
