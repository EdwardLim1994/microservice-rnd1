import { CronDriver, ServerApp } from "server";

export default async function main() {
	await ServerApp.init(CronDriver).run(() => `Server is running`);
}
