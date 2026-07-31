import { GrpcDriver, HealthCheckPlugin, OtelPlugin, PgAdapter, RedisPlugin, ServerApp, transient } from "server";
import { PrismaClient } from "../generated/prisma";
import ItemRepository from "./repositories/ItemRepository";
import ItemGrpcRouter from "./routers/ItemGrpcRouter";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

export default async function main() {
	await ServerApp.init([
		{
			driver: GrpcDriver,
			port: Number(import.meta.env.GRPC_PORT),
			onReady: ({ host, port }) =>
				console.log(`gRPC server is running on ${host}:${port}`),
		},
	])
		.database(PrismaClient, new PgAdapter(databaseUrl))
		.plugins([HealthCheckPlugin, RedisPlugin, OtelPlugin])
		.containers({ itemRepository: transient(ItemRepository) })
		.routers([ItemGrpcRouter])
		.run(() => `Server is running`);
}
