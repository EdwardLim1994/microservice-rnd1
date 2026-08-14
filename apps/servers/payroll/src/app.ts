import {
  CronDriver,
  GrpcDriver,
  HealthCheckPlugin,
  LoggerPlugin,
  MinioPlugin,
  PgAdapter,
  ServerApp,
  singleton,
} from 'server';
import { PrismaClient } from '../generated/prisma';
import { PayrollRepository } from './repositories/PayrollRepository';
import { PayrollCronRouter } from './routers/PayrollCronRouter';
import { PayrollGrpcRouter } from './routers/PayrollGrpcRouter';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const grpcPort = Number(process.env.GRPC_PORT ?? 5003);

export default async function main() {
  await ServerApp.init([
    { driver: CronDriver },
    { driver: GrpcDriver, port: grpcPort },
  ])
    .database(PrismaClient, new PgAdapter(databaseUrl))
    .containers({ payrollRepository: singleton(PayrollRepository) })
    .plugins([HealthCheckPlugin, LoggerPlugin, MinioPlugin])
    .routers([PayrollCronRouter, PayrollGrpcRouter])
    .run(() => `payroll cron + gRPC listening on :${grpcPort}`);
}
