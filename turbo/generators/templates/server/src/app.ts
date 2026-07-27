import { HealthCheckPlugin, ServerApp } from "server";

export default async function main() {
	await ServerApp.init([])
		.plugins([HealthCheckPlugin])
		.run(() => `Server is running`);
}
