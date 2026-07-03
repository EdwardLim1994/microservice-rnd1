import {
  ApolloDriver,
  GrpcDriver,
  KafkaDriver,
  SchemaRegistryKafkaSerializer,
  ServerApp,
} from "server";
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
      config: {
        // No `schemas` needed — demo2 only ever consumes, and decode fetches whatever
        // schema the producer registered. DemoKafkaRouter resolves this same instance
        // (registered as kafkaSerializer) from the container to build its decoders.
        serializer: new SchemaRegistryKafkaSerializer(),
      },
      onReady: () => console.log("Kafka consumer is running"),
    },
  ])
    .routers([DemoGrpcRouter, DemoGraphqlRouter, DemoKafkaRouter])
    .run();
}
