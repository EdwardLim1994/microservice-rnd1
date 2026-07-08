import { test1EventsSchemas, test1EventsTopics } from "api";
import {
	ApolloDriver,
	GrpcDriver,
	KafkaDriver,
	PgAdapter,
	SchemaRegistryKafkaSerializer,
	ServerApp,
	singleton,
} from "server";
import { PrismaClient } from "../generated/prisma";
import Test1GrpcClient from "./clients/Test1GrpcClient";
import { Test1Repository } from "./repositories";
import { Test1GraphqlRouter, Test1GrpcRouter } from "./routers";

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
			driver: KafkaDriver,
			config: {
				// test1 only produces to this topic — no KafkaConsumerRouter declares it, so it's
				// listed here to be provisioned up front instead of racing the broker's
				// auto-create. test1EventsTopics/test1EventsSchemas (from `api`) are the shared
				// topic declaration — any future consumer server would import the same
				// test1EventsTopics for its topicTypes.
				topics: test1EventsTopics,
				// Lets kafkaProducer.send("test1.events", value) auto-serialize a plain value via
				// Schema Registry instead of every use case building its own serializer.
				serializer: new SchemaRegistryKafkaSerializer({
					schemas: test1EventsSchemas,
				}),
			},
			onReady: () => console.log("Kafka producer is running"),
		},
	])
		.database(PrismaClient, new PgAdapter(import.meta.env.DATABASE_URL!))
		.containers({
			test1GrpcClient: singleton(Test1GrpcClient),
			test1Repository: singleton(Test1Repository),
		})
		.routers([Test1GrpcRouter, Test1GraphqlRouter])
		.run(() => `Server is running`);
}
