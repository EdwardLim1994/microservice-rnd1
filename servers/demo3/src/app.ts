import { GrpcDriver, PgAdapter, ServerApp, singleton } from "lib";
import { PrismaClient } from "./generated/prisma";
import { DemoRepository } from "./repositories/";
import { DemoRouter } from "./routers";

export default async function main() {
	await ServerApp.init(GrpcDriver)
		.database(PrismaClient, new PgAdapter(import.meta.env.DATABASE_URL!))
		.containers({
			demoRepository: singleton(DemoRepository),
		})
		.routers([DemoRouter])
		.port(5003)
		.run((port: number, host: string) => {
			console.log(`Server is running in ${host}:${port}`);
		});
}
