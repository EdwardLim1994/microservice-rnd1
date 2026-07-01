import { ApolloDriver, GrpcDriver, KafkaDriver, ServerApp } from "lib";
import { DemoGraphqlRouter, DemoGrpcRouter, DemoKafkaRouter } from "./routers";

export default async function main() {
	await ServerApp.init([
		{
			driver: GrpcDriver,
			port: 5002,
			onReady: ({ host, port }) =>
				console.log(`gRPC server is running on ${host}:${port}`),
		},
		{
			driver: ApolloDriver,
			port: 4002,
			onReady: ({ host, port }) =>
				console.log(`GraphQL server is running on ${host}:${port}`),
		},
		{
			driver: KafkaDriver,
			onReady: () => console.log("Kafka consumer is running"),
		},
	])
		.routers([DemoGrpcRouter, DemoGraphqlRouter, DemoKafkaRouter])
		.run();
}
