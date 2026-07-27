import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	injectDriverEntry,
	mergePackageJsonDeps,
	wireHelmDeploymentConfigMap,
	writePackageJson,
} from "../helpers";
import type { ServerDriverExtension } from "./types";

type KafkaRole = "producer" | "consumer" | "both";

const TEMPLATES_DIR = path.join(
	process.cwd(),
	"turbo",
	"generators",
	"templates",
	"kafka",
);

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

/**
 * Merges the Kafka packages into an existing package.json, preserving that file's own
 * indentation style. Unlike gRPC/GraphQL, Kafka has no codegen step of its own (topics/schemas
 * are hand-declared in packages/api, not generated), so there's no "gen" script to touch here.
 */
function mergeKafkaIntoPackageJson(absPackageJsonPath: string): string {
	const { pkg, indent } = mergePackageJsonDeps(
		absPackageJsonPath,
		{},
		{ kafkajs: "^2.2.4", "@confluentinc/schemaregistry": "^1.9.1" },
	);
	writePackageJson(absPackageJsonPath, pkg, indent);
	return `${relToRoot(absPackageJsonPath)} (+kafkajs, @confluentinc/schemaregistry)`;
}

/**
 * Appends the Kafka/Schema Registry env vars to .env.sample (creating it if somehow missing)
 * and, only if it already exists, to .env too — .env is gitignored and may not exist in a
 * fresh checkout. KAFKA_GROUP_ID is only meaningful for a consumer (see KafkaDriver's
 * `groupId ?? process.env.KAFKA_GROUP_ID ?? 'default-group'` fallback), so "producer" alone
 * skips it — "both" needs it just as much as "consumer" does.
 */
function appendKafkaEnv(
	absPath: string,
	name: string,
	role: KafkaRole,
	createIfMissing: boolean,
): string | null {
	const lines = [`KAFKA_BROKERS=localhost:29092`, `KAFKA_CLIENT_ID=${name}`];
	if (role !== "producer") lines.push(`KAFKA_GROUP_ID=${name}-group`);

	if (!fs.existsSync(absPath)) {
		if (!createIfMissing) return null;
		fs.writeFileSync(
			absPath,
			`# Kafka\n${lines.join("\n")}\n\n# Schema Registry\nSCHEMA_REGISTRY_URL=http://localhost:8081\n`,
		);
		return `${relToRoot(absPath)} (created, +Kafka/Schema Registry env)`;
	}
	const existing = fs.readFileSync(absPath, "utf-8");
	if (existing.includes("KAFKA_BROKERS=")) {
		return `${relToRoot(absPath)} already has Kafka env`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	const registryBlock = existing.includes("SCHEMA_REGISTRY_URL=")
		? ""
		: "\n# Schema Registry\nSCHEMA_REGISTRY_URL=http://localhost:8081\n";
	fs.writeFileSync(
		absPath,
		`${existing}${separator}\n# Kafka\n${lines.join("\n")}\n${registryBlock}`,
	);
	return `${relToRoot(absPath)} (+Kafka/Schema Registry env)`;
}

function buildKafkaDriverEntry(itemIndent: string, role: KafkaRole): string {
	const onReadyMessage = {
		producer: "Kafka producer is running",
		consumer: "Kafka consumer is running",
		both: "Kafka producer/consumer is running",
	}[role];
	return (
		`{\n${itemIndent}\tdriver: KafkaDriver,\n${itemIndent}\tconfig: {\n` +
		`${itemIndent}\t\t// TODO: once topics/schemas are declared in packages/api, wire them in here —\n` +
		`${itemIndent}\t\t// see apps/servers/demo1/src/app.ts (producer) / apps/servers/demo2/src/app.ts (consumer)\n` +
		`${itemIndent}\t\tserializer: new SchemaRegistryKafkaSerializer(),\n${itemIndent}\t},\n` +
		`${itemIndent}\tonReady: () => console.log("${onReadyMessage}"),\n${itemIndent}}`
	);
}

function registerActionTypes(plop: PlopTypes.NodePlopAPI): void {
	plop.setActionType("addKafkaPackageJson", (answers) => {
		const { location } = answers as { location: string };
		return mergeKafkaIntoPackageJson(
			path.join(process.cwd(), location, "package.json"),
		);
	});

	plop.setActionType("appendKafkaEnv", (answers) => {
		const { location, role } = answers as { location: string; role: KafkaRole };
		const name = path.basename(location);
		const results = [
			appendKafkaEnv(
				path.join(process.cwd(), location, ".env.sample"),
				name,
				role,
				true,
			),
			appendKafkaEnv(
				path.join(process.cwd(), location, ".env"),
				name,
				role,
				false,
			),
		].filter((result): result is string => result !== null);
		return results.length > 0 ? results.join("; ") : "no .env files updated";
	});

	plop.setActionType("injectKafkaDriver", (answers) => {
		const { location, role } = answers as { location: string; role: KafkaRole };
		return injectDriverEntry(
			path.join(process.cwd(), location, "src", "app.ts"),
			"KafkaDriver",
			(itemIndent) => buildKafkaDriverEntry(itemIndent, role),
			["SchemaRegistryKafkaSerializer"],
		);
	});

	// Writes the <name>-kafka-env ConfigMap into this server's own helm chart (kafka/schema-registry
	// already run as their own services/kafka Deployments — see services/kafka/helm — so, unlike
	// DatabaseGenerator's <name>-db, there's no sidecar resource to create here, just the env
	// wiring) and references it from the app container's envFrom, same helper DatabaseGenerator
	// uses for its own ConfigMap — each driver/extension gets its own entry in the same list.
	plop.setActionType("wireKafkaHelm", (answers, _config, plopApi) => {
		const { location, role } = answers as { location: string; role: KafkaRole };
		const name = path.basename(location);

		const template = fs.readFileSync(
			path.join(TEMPLATES_DIR, "helm-env.yaml.hbs"),
			"utf-8",
		);
		const rendered = plopApi.renderString(template, {
			name,
			includeGroupId: role !== "producer",
		});
		const helmTemplatesDir = path.join(
			process.cwd(),
			location,
			"helm",
			"templates",
		);
		const destPath = path.join(helmTemplatesDir, "kafka-env.yaml");
		let chartResult: string;
		if (fs.existsSync(destPath)) {
			chartResult = `${relToRoot(destPath)} already exists`;
		} else {
			fs.mkdirSync(helmTemplatesDir, { recursive: true });
			fs.writeFileSync(destPath, rendered);
			chartResult = relToRoot(destPath);
		}

		const wireResult = wireHelmDeploymentConfigMap(
			path.join(
				process.cwd(),
				location,
				"helm",
				"templates",
				"deployment.yaml",
			),
			`${name}-kafka-env`,
		);
		return `${chartResult}; ${wireResult}`;
	});
}

const KafkaGenerator: ServerDriverExtension = {
	value: "kafka",
	label: "Kafka",
	driverName: "KafkaDriver",
	registerActionTypes,
	extraPrompts: [
		{
			type: "list",
			name: "role",
			message:
				"Role (producer only sets up the serializer; consumer/both also get KAFKA_GROUP_ID — add a Kafka router afterwards via the 'router' generator to actually consume):",
			choices: [
				{ name: "Producer", value: "producer" },
				{ name: "Consumer", value: "consumer" },
				{ name: "Both", value: "both" },
			],
			when: (answers: { driver?: string }) => answers.driver === "kafka",
		},
	],
	actions: [
		{ type: "addKafkaPackageJson" },
		{ type: "appendKafkaEnv" },
		{ type: "injectKafkaDriver" },
		{ type: "wireKafkaHelm" },
	],
};

export default KafkaGenerator;
