import {
	ApolloDriver,
	CronDriver,
	GrpcDriver,
	MinioPlugin,
	ServerApp,
	singleton,
	VaultPgAdapter,
} from "server";
import { PrismaClient } from "../generated/prisma";
import NotificationRepository from "./repositories/NotificationRepository";
import PayslipRepository from "./repositories/PayslipRepository";
import PayrollCronRouter from "./routers/PayrollCronRouter";
import PayrollGraphqlRouter from "./routers/PayrollGraphqlRouter";

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
		})
		.routers([PayrollGraphqlRouter, PayrollCronRouter])
		.run(() => `Server is running`);
}
