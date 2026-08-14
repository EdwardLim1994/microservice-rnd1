import {
	GrpcDriver,
	HealthCheckPlugin,
	JsonKafkaSerializer,
	KafkaDriver,
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
const kafkaBrokers = (process.env.KAFKA_BROKERS ?? "localhost:29092").split(
	",",
);

export default async function main() {
	await ServerApp.init([
		{ driver: GrpcDriver, port: grpcPort },
		{
			driver: KafkaDriver,
			config: { brokers: kafkaBrokers, serializer: new JsonKafkaSerializer() },
		},
	])
		.database(PrismaClient, new PgAdapter(databaseUrl))
		.containers({ leaveRepository: singleton(LeaveRepository) })
		.plugins([HealthCheckPlugin, LoggerPlugin])
		.routers([LeaveGrpcRouter])
		.run(() => `leave gRPC listening on :${grpcPort}`);
}
