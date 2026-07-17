import { ApolloDriver, CronDriver, GrpcDriver, MinioPlugin, ServerApp, VaultPgAdapter } from "server";
import { PrismaClient } from "../generated/prisma";

export default async function main() {
	await ServerApp.init([
		{
			driver: GrpcDriver,
			port: Number(import.meta.env.GRPC_PORT),
			onReady: ({ host, port }) =>
				console.log(`gRPC server is running on ${host}:${port}`),
		},
		{
			driver: ApolloDriver,
			port: Number(import.meta.env.GRAPHQL_PORT),
			onReady: ({ host, port }) =>
				console.log(`GraphQL server is running on ${host}:${port}`),
		},
		{
			driver: CronDriver,
			onReady: () => console.log("Cron driver is running"),
		},
	])
		.database(PrismaClient, () => VaultPgAdapter.fromEnv())
		.plugins([MinioPlugin])
		.run(() => `Server is running`);
}
