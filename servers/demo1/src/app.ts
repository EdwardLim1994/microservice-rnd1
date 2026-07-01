import { Demo1Demo1Proto } from "api";
import {
	ApolloDriver,
	GrpcDriver,
	KafkaDriver,
	PgAdapter,
	RedisPlugin,
	ServerApp,
	singleton,
} from "lib";
import { PrismaClient } from "./generated/prisma";
import { DemoRepository } from "./repositories";
import { DemoGraphqlRouter, DemoGrpcRouter } from "./routers";

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
			// demo1 only produces to this topic — no KafkaConsumerRouter declares it, so it's
			// listed here to be provisioned up front instead of racing the broker's auto-create.
			config: { topics: { "demo1.events": Demo1Demo1Proto.Demo1 } },
			onReady: () => console.log(`Kafka producer is running`),
		},
	])
		.database(PrismaClient, new PgAdapter(import.meta.env.DATABASE_URL!))
		.containers({
			demoRepository: singleton(DemoRepository),
		})
		.plugins([RedisPlugin])
		.routers([DemoGrpcRouter, DemoGraphqlRouter])
		.run();
}
