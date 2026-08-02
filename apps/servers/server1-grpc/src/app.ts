import { Server1GrpcItemEventsPbProto } from "api";
import {
	GrpcDriver,
	HealthCheckPlugin,
	KafkaDriver,
	OtelPlugin,
	PgAdapter,
	RedisPlugin,
	SchemaRegistryKafkaSerializer,
	ServerApp,
	transient,
} from "server";
import { PrismaClient } from "../generated/prisma";
import ItemRepository from "./repositories/ItemRepository";
import ItemGrpcRouter from "./routers/ItemGrpcRouter";
import { ITEM_CREATED_TOPIC } from "./topics";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

export default async function main() {
	const kafkaSerializer = new SchemaRegistryKafkaSerializer({
		schemas: { [ITEM_CREATED_TOPIC]: Server1GrpcItemEventsPbProto.ItemCreatedEventSchema },
	});

	await ServerApp.init([
		{
			driver: GrpcDriver,
			port: Number(import.meta.env.GRPC_PORT),
			onReady: ({ host, port }) =>
				console.log(`gRPC server is running on ${host}:${port}`),
		},
		{
			driver: KafkaDriver,
			config: {
				serializer: kafkaSerializer,
				// Pre-provisions the topic up front (see KafkaDriverConfig.topics) instead of
				// relying on the broker's auto-create racing this producer's first send().
				topics: { [ITEM_CREATED_TOPIC]: kafkaSerializer.decoder(ITEM_CREATED_TOPIC) },
			},
			onReady: () => console.log("Kafka producer is running"),
		},
	])
		.database(PrismaClient, new PgAdapter(databaseUrl))
		.plugins([HealthCheckPlugin, RedisPlugin, OtelPlugin])
		.containers({ itemRepository: transient(ItemRepository) })
		.routers([ItemGrpcRouter])
		.run();
}
