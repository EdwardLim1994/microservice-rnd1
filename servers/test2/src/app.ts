import {
	ApolloDriver,
	GrpcDriver,
	KafkaDriver,
	SchemaRegistryKafkaSerializer,
	ServerApp,
	singleton,
} from "server";
import Test2GrpcClient from "./clients/Test2GrpcClient";
import { Test2GraphqlRouter, Test2GrpcRouter, Test2KafkaRouter } from "./routers";

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
				// No `schemas` needed — test2 only ever consumes, and decode fetches whatever
				// schema the producer registered. Test2KafkaRouter resolves this same instance
				// (registered as kafkaSerializer) from the container to build its decoders.
				// Topics aren't declared here either — Test2KafkaRouter's topicTypes is what
				// gets provisioned for a consumer server (config.topics is only for a
				// producer with no KafkaConsumerRouter of its own, e.g. test1).
				serializer: new SchemaRegistryKafkaSerializer(),
			},
			onReady: () => console.log("Kafka consumer is running"),
		},
	])
		.containers({
			test2GrpcClient: singleton(Test2GrpcClient),
		})
		.routers([Test2GrpcRouter, Test2GraphqlRouter, Test2KafkaRouter])
		.run(() => `Server is running`);
}
