import { ApolloDriver, GrpcDriver, ServerApp, VaultPgAdapter, singleton, transient } from "server";
import { PrismaClient } from "../generated/prisma";
import EmployeeServiceClient from "./clients/EmployeeServiceClient";
import LeaveRequestRepository from "./repositories/LeaveRequestRepository";
import LeaveGraphqlRouter from "./routers/LeaveGraphqlRouter";
import LeaveGrpcRouter from "./routers/LeaveGrpcRouter";
import ReviewLeaveUseCase from "./usecases/ReviewLeaveUseCase";
import SubmitLeaveUseCase from "./usecases/SubmitLeaveUseCase";

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
			leaveRequestRepository: singleton(LeaveRequestRepository),
			employeeServiceClient: singleton(EmployeeServiceClient),
			// Explicitly registered — the gRPC adapter use cases inject these directly, same
			// convention as employee-subgraph's app.ts.
			submitLeaveUseCase: transient(SubmitLeaveUseCase),
			reviewLeaveUseCase: transient(ReviewLeaveUseCase),
		})
		.routers([LeaveGraphqlRouter, LeaveGrpcRouter])
		.run(() => `Server is running`);
}
