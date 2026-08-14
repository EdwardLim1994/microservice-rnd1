import {
	GrpcDriver,
	HealthCheckPlugin,
	LoggerPlugin,
	PgAdapter,
	ServerApp,
	singleton,
} from "server";
import { PrismaClient } from "../generated/prisma";
import { LeaveRepository } from "./repositories/LeaveRepository";
import { LeaveGrpcRouter } from "./routers/LeaveGrpcRouter";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const grpcPort = Number(process.env.GRPC_PORT ?? 5002);

export default async function main() {
	await ServerApp.init([{ driver: GrpcDriver, port: grpcPort }])
		.database(PrismaClient, new PgAdapter(databaseUrl))
		.containers({ leaveRepository: singleton(LeaveRepository) })
		.plugins([HealthCheckPlugin, LoggerPlugin])
		.routers([LeaveGrpcRouter])
		.run(() => `leave gRPC listening on :${grpcPort}`);
}
