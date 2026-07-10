import { ApolloDriver, AuthentikPlugin, ServerApp } from "server";
import AuthGraphqlRouter from "./routers/AuthGraphqlRouter";

export default async function main() {
	await ServerApp.init([
		{
			driver: ApolloDriver,
			port: Number(import.meta.env.GRAPHQL_PORT),
			onReady: ({ host, port }) =>
				console.log(`GraphQL server is running on ${host}:${port}`),
		},
	])
		.plugins([AuthentikPlugin])
		.routers([AuthGraphqlRouter])
		.run(() => `Server is running`);
}
