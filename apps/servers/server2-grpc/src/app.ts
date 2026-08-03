import {
	GrpcDriver,
	HealthCheckPlugin,
	JsonKafkaSerializer,
	KafkaDriver,
	MeilisearchPlugin,
	OtelPlugin,
	PgAdapter,
	ServerApp,
	transient,
} from "server";
import { PrismaClient } from "../generated/prisma";
import Item2Repository from "./repositories/Item2Repository";
import Item2DebeziumRouter from "./routers/Item2DebeziumRouter";
import Item2GrpcRouter from "./routers/Item2GrpcRouter";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

export default async function main() {
	await ServerApp.init([
		{
			driver: GrpcDriver,
			port: Number(import.meta.env.GRPC_PORT),
			onReady: ({ host, port }) =>
				console.log(`gRPC server is running on ${host}:${port}`),
		},
		{
			// Consumer-only — Debezium (apps/servers/server2-grpc-infra/helm/templates/
			// debezium.yaml) is the only producer onto its own topic; this server never
			// produces to Kafka itself, so a plain JsonKafkaSerializer (no Schema Registry) is
			// enough just to decode Debezium's JSON change events.
			driver: KafkaDriver,
			config: {
				serializer: new JsonKafkaSerializer(),
			},
			onReady: () => console.log("Kafka consumer is running"),
		},
	])
		.database(PrismaClient, new PgAdapter(databaseUrl))
		.plugins([HealthCheckPlugin, MeilisearchPlugin, OtelPlugin])
		.containers({
			item2Repository: transient(Item2Repository),
		})
		.routers([Item2GrpcRouter, Item2DebeziumRouter])
		.run();
}
