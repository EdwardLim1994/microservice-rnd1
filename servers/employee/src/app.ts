import { ApolloDriver, AuthentikPlugin, GrpcDriver, ServerApp, singleton, transient, VaultPgAdapter } from "server";
import { PrismaClient } from "../generated/prisma";
import EmployeeRepository from "./repositories/EmployeeRepository";
import EmployeeGraphqlRouter from "./routers/EmployeeGraphqlRouter";
import EmployeeGrpcRouter from "./routers/EmployeeGrpcRouter";
import AssignSupervisorUseCase from "./usecases/AssignSupervisorUseCase";
import RegisterEmployeeUseCase from "./usecases/RegisterEmployeeUseCase";

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
			// Explicitly registered (not left to whichever router's auto-registration runs
			// first) — the gRPC adapter use cases (RegisterEmployeeGrpcUseCase,
			// AssignSupervisorGrpcUseCase) inject these directly, and relying on
			// EmployeeGraphqlRouter's own auto-registration to have already run first would
			// couple gRPC's DI graph to GraphQL router startup ordering.
			registerEmployeeUseCase: transient(RegisterEmployeeUseCase),
			assignSupervisorUseCase: transient(AssignSupervisorUseCase),
		})
		.routers([EmployeeGraphqlRouter, EmployeeGrpcRouter])
		.run(() => `Server is running`);
}
