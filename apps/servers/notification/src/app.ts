import {
  ApolloDriver,
  HealthCheckPlugin,
  JsonKafkaSerializer,
  KafkaDriver,
  LoggerPlugin,
  PgAdapter,
  ServerApp,
  singleton,
} from 'server';
import { PrismaClient } from '../generated/prisma';
import { NotificationRepository } from './repositories/NotificationRepository';
import { NotificationGraphqlRouter } from './routers/NotificationGraphqlRouter';
import { NotificationKafkaRouter } from './routers/NotificationKafkaRouter';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const graphqlPort = Number(process.env.GRAPHQL_PORT ?? 4004);
const kafkaBrokers = (process.env.KAFKA_BROKERS ?? 'localhost:29092').split(
  ',',
);
const kafkaGroupId = process.env.KAFKA_GROUP_ID ?? 'notification-service';

export default async function main() {
  await ServerApp.init([
    {
      driver: KafkaDriver,
      config: {
        brokers: kafkaBrokers,
        groupId: kafkaGroupId,
        serializer: new JsonKafkaSerializer(),
      },
    },
    { driver: ApolloDriver, port: graphqlPort },
  ])
    .database(PrismaClient, new PgAdapter(databaseUrl))
    .containers({ notificationRepository: singleton(NotificationRepository) })
    .plugins([HealthCheckPlugin, LoggerPlugin])
    .routers([NotificationKafkaRouter, NotificationGraphqlRouter])
    .run(
      () =>
        `notification Kafka consumer + GraphQL listening on :${graphqlPort}`,
    );
}
