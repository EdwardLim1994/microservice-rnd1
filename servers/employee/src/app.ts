import { ApolloDriver, AuthentikPlugin, GrpcDriver, ServerApp, singleton, VaultPgAdapter } from "server";
import { PrismaClient } from "../generated/prisma";
import EmployeeRepository from "./repositories/EmployeeRepository";
import EmployeeGraphqlRouter from "./routers/EmployeeGraphqlRouter";

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
	])
		.database(PrismaClient, () => VaultPgAdapter.fromEnv())
		.plugins([AuthentikPlugin])
		.containers({
			employeeRepository: singleton(EmployeeRepository),
		})
		.routers([EmployeeGraphqlRouter])
		.run(() => `Server is running`);
}
