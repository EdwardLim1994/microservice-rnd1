import { CronDriver, ServerApp } from "server";

export default async function main() {
	await ServerApp.init([]).run(() => `Server is running`);
}
