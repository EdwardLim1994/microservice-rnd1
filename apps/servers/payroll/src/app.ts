import { CronDriver, HealthCheckPlugin, LoggerPlugin, PgAdapter, ServerApp } from "server";
import { PrismaClient } from "../generated/prisma";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

export default async function main() {
	await ServerApp.init([
		{
			driver: CronDriver,
			onReady: () => console.log("Cron driver is running"),
		},
	])
		.database(PrismaClient, new PgAdapter(databaseUrl))
		.plugins([HealthCheckPlugin, LoggerPlugin])
		.run(() => `Server is running`);
}
