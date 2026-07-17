import {
	ApolloDriver,
	CronDriver,
	GrpcDriver,
	MinioPlugin,
	ServerApp,
	singleton,
	transient,
	VaultPgAdapter,
} from "server";
import { PrismaClient } from "../generated/prisma";
import NotificationRepository from "./repositories/NotificationRepository";
import PayslipRepository from "./repositories/PayslipRepository";
import PayrollCronRouter from "./routers/PayrollCronRouter";
import PayrollGraphqlRouter from "./routers/PayrollGraphqlRouter";
import PayrollGrpcRouter from "./routers/PayrollGrpcRouter";
import GeneratePayslipsUseCase from "./usecases/GeneratePayslipsUseCase";
import GetPayslipURLUseCase from "./usecases/GetPayslipURLUseCase";
import StorePayslipUseCase from "./usecases/StorePayslipUseCase";

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
		.containers({
			payslipRepository: singleton(PayslipRepository),
			notificationRepository: singleton(NotificationRepository),
			// Explicitly registered — see servers/employee/src/app.ts's equivalent comment.
			storePayslipUseCase: transient(StorePayslipUseCase),
			generatePayslipsUseCase: transient(GeneratePayslipsUseCase),
			getPayslipURLUseCase: transient(GetPayslipURLUseCase),
		})
		.routers([PayrollGraphqlRouter, PayrollGrpcRouter, PayrollCronRouter])
		.run(() => `Server is running`);
}
