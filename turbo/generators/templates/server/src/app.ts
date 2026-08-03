import { HealthCheckPlugin, LoggerPlugin, ServerApp } from "server";

export default async function main() {
	await ServerApp.init([])
		.plugins([HealthCheckPlugin, LoggerPlugin])
		.run(() => `Server is running`);
}
