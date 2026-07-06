import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { injectDriverEntry } from "../helpers";
import type { ServerDriverExtension } from "./types";

// Unlike gRPC/GraphQL/Kafka, CronDriver needs no package.json deps (Bun.cron is built in), no
// port, and no env vars — it's just a driver entry in app.ts.
function buildCronDriverEntry(itemIndent: string): string {
	return (
		`{\n${itemIndent}\tdriver: CronDriver,\n` +
		`${itemIndent}\tonReady: () => console.log("Cron driver is running"),\n${itemIndent}}`
	);
}

function registerActionTypes(plop: PlopTypes.NodePlopAPI): void {
	plop.setActionType("injectCronDriver", (answers) => {
		const { location } = answers as { location: string };
		return injectDriverEntry(
			path.join(process.cwd(), location, "src", "app.ts"),
			"CronDriver",
			buildCronDriverEntry,
		);
	});
}

const CronGenerator: ServerDriverExtension = {
	value: "cron",
	label: "Cron",
	driverName: "CronDriver",
	registerActionTypes,
	actions: [{ type: "injectCronDriver" }],
};

export default CronGenerator;
