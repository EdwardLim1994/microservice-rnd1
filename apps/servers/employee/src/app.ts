import {
  GrpcDriver,
  HealthCheckPlugin,
  LoggerPlugin,
  PgAdapter,
  ServerApp,
  singleton,
} from 'server';
import { PrismaClient } from '../generated/prisma';
import { EmployeeRepository } from './repositories/EmployeeRepository';
import { EmployeeGrpcRouter } from './routers/EmployeeGrpcRouter';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const grpcPort = Number(process.env.GRPC_PORT ?? 5001);

export default async function main() {
  await ServerApp.init([{ driver: GrpcDriver, port: grpcPort }])
    .database(PrismaClient, new PgAdapter(databaseUrl))
    .containers({ employeeRepository: singleton(EmployeeRepository) })
    .plugins([HealthCheckPlugin, LoggerPlugin])
    .routers([EmployeeGrpcRouter])
    .run(() => `employee gRPC listening on :${grpcPort}`);
}
