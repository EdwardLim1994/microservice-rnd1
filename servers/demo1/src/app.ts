import { demo1EventsSchemas, demo1EventsTopics } from "api";
import {
	ApolloDriver,
	CronDriver,
	GrpcDriver,
	KafkaDriver,
	PgAdapter,
	RedisPlugin,
	SchemaRegistryKafkaSerializer,
	ServerApp,
	singleton,
} from "server";
import { PrismaClient } from "../generated/prisma";
import { LoggingInterceptor } from "./interceptors";
import { DemoRepository } from "./repositories";
import { DemoCronRouter, DemoGraphqlRouter, DemoGrpcRouter } from "./routers";

export default async function main() {
	await ServerApp.init([
		{
			driver: GrpcDriver,
			port: 5001,
			onReady: ({ host, port }) =>
				console.log(`gRPC server is running on ${host}:${port}`),
		},
		{
			driver: ApolloDriver,
			port: 4001,
			onReady: ({ host, port }) =>
				console.log(`GraphQL server is running on ${host}:${port}`),
		},
		{
			driver: KafkaDriver,
			config: {
				// demo1 only produces to this topic — no KafkaConsumerRouter declares it, so it's
				// listed here to be provisioned up front instead of racing the broker's auto-create.
				// demo1EventsTopics/demo1EventsSchemas (from `api`) are the shared topic declaration
				// — demo2's DemoKafkaRouter imports the same demo1EventsTopics for its topicTypes.
				topics: demo1EventsTopics,
				// Lets kafkaProducer.send("demo1.events", value) auto-serialize a plain value via
				// Schema Registry instead of every use case building its own serializer.
				serializer: new SchemaRegistryKafkaSerializer({
					schemas: demo1EventsSchemas,
				}),
			},
			onReady: () => console.log(`Kafka producer is running`),
		},
		{
			driver: CronDriver,
			onReady: () => console.log(`Cron driver is running`),
		},
	])
		.interceptors([LoggingInterceptor])
		.database(PrismaClient, new PgAdapter(import.meta.env.DATABASE_URL!))
		.containers({
			demoRepository: singleton(DemoRepository),
		})
		.plugins([RedisPlugin])
		.routers([DemoGrpcRouter, DemoGraphqlRouter, DemoCronRouter])
		.run();
}
