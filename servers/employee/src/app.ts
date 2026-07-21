import {
	ApolloDriver,
	AuthentikPlugin,
	GrpcDriver,
	ServerApp,
	singleton,
	VaultPgAdapter,
} from "server";
import { PrismaClient } from "../generated/prisma";
import EmployeeRepository from "./repositories/EmployeeRepository";
import EmployeeGraphqlRouter from "./routers/EmployeeGraphqlRouter";
import EmployeeGrpcRouter from "./routers/EmployeeGrpcRouter";

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
		.containers({
			employeeRepository: singleton(EmployeeRepository),
		})
		.plugins([AuthentikPlugin])
		.routers([EmployeeGrpcRouter, EmployeeGraphqlRouter])
		.run(() => `Server is running`);
}
