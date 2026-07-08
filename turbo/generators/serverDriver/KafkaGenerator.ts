import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	findMatchingBracket,
	injectDriverEntry,
	mergePackageJsonDeps,
	wireComposeService,
	writePackageJson,
} from "../helpers";
import type { ServerDriverExtension } from "./types";

type KafkaRole = "producer" | "consumer" | "both";

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

// Merges the Kafka packages into an existing package.json, preserving that file's own
// indentation style. Unlike gRPC/GraphQL, Kafka has no codegen step of its own (topics/schemas
// are hand-declared in packages/api, not generated), so there's no "gen" script to touch here.
function mergeKafkaIntoPackageJson(absPackageJsonPath: string): string {
	const { pkg, indent } = mergePackageJsonDeps(
		absPackageJsonPath,
		{},
		{ kafkajs: "^2.2.4", "@confluentinc/schemaregistry": "^1.9.1" },
	);
	writePackageJson(absPackageJsonPath, pkg, indent);
	return `${relToRoot(absPackageJsonPath)} (+kafkajs, @confluentinc/schemaregistry)`;
}

// Appends the Kafka/Schema Registry env vars to .env.sample (creating it if somehow missing)
// and, only if it already exists, to .env too — .env is gitignored and may not exist in a
// fresh checkout. KAFKA_GROUP_ID is only meaningful for a consumer (see KafkaDriver's
// `groupId ?? process.env.KAFKA_GROUP_ID ?? 'default-group'` fallback), so "producer" alone
// skips it — "both" needs it just as much as "consumer" does.
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
		`${itemIndent}\t\t// see servers/demo1/src/app.ts (producer) / servers/demo2/src/app.ts (consumer)\n` +
		`${itemIndent}\t\tserializer: new SchemaRegistryKafkaSerializer(),\n${itemIndent}\t},\n` +
		`${itemIndent}\tonReady: () => console.log("${onReadyMessage}"),\n${itemIndent}}`
	);
}

// In-cluster Kafka/Schema Registry (services/kafka/helm, deployed via services/terraform into
// the shared "infra" namespace) — cross-namespace Service FQDN, port 9092 (its single PLAINTEXT
// listener). This is a fixed, environment-wide address, not server-specific — every server
// deployed into this same cluster points at the same "infra" namespace. Previously defaulted to
// host.minikube.internal:29093 (the docker-compose Kafka's minikube-specific listener) — that
// container isn't guaranteed to stay running once k8s is the primary deploy target, confirmed
// the hard way on servers/demo1 and servers/demo2 (both crash-looped with ECONNREFUSED after the
// docker-compose stack died independently of the k8s cluster). See
// servers/demo1/helm/values.yaml's kafka.brokers comment for the full story.
function helmKafkaValuesBlock(name: string, role: KafkaRole): string {
	const groupIdLine = role !== "producer" ? `\n  groupId: ${name}-group` : "";
	return (
		`\nkafka:\n  clientId: ${name}${groupIdLine}\n` +
		`  # In-cluster Kafka (services/kafka/helm, shared "infra" namespace) — see\n` +
		`  # servers/demo1/helm/values.yaml's kafka.brokers comment for why this isn't the\n` +
		`  # docker-compose address.\n` +
		`  brokers: kafka.infra.svc.cluster.local:9092\n\n` +
		`schemaRegistry:\n  url: http://schema-registry.infra.svc.cluster.local:8081\n`
	);
}

function addKafkaHelmValues(location: string, name: string, role: KafkaRole): string {
	const absPath = path.join(process.cwd(), location, "helm", "values.yaml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	const raw = fs.readFileSync(absPath, "utf-8");
	if (raw.includes("\nkafka:")) {
		return `${relToRoot(absPath)} already has kafka config`;
	}
	const separator = raw.endsWith("\n") ? "" : "\n";
	fs.writeFileSync(absPath, `${raw}${separator}${helmKafkaValuesBlock(name, role)}`);
	return `${relToRoot(absPath)} (+kafka, +schemaRegistry)`;
}

function addKafkaConfigmapEnv(location: string, role: KafkaRole): string {
	const absPath = path.join(process.cwd(), location, "helm", "templates", "configmap.yaml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	const raw = fs.readFileSync(absPath, "utf-8");
	if (raw.includes("KAFKA_BROKERS")) {
		return `${relToRoot(absPath)} already has Kafka config`;
	}
	const lines = [
		"  KAFKA_BROKERS: {{ .Values.kafka.brokers | quote }}",
		"  KAFKA_CLIENT_ID: {{ .Values.kafka.clientId | quote }}",
		"  SCHEMA_REGISTRY_URL: {{ .Values.schemaRegistry.url | quote }}",
	];
	if (role !== "producer") lines.push("  KAFKA_GROUP_ID: {{ .Values.kafka.groupId | quote }}");
	const separator = raw.endsWith("\n") ? "" : "\n";
	fs.writeFileSync(absPath, `${raw}${separator}${lines.join("\n")}\n`);
	return `${relToRoot(absPath)} (+Kafka/Schema Registry config)`;
}

// Inserts `snippet` just before the closing brace of the first `{ ... }` block found after
// `marker` in the file — shared by the two terraform injections below (a helm_release resource's
// body, a module call's body). Skipped (not an error) if the file doesn't exist — a server
// scaffolded before this generator enhancement existed won't have one; skipped (idempotent) if
// `uniqueMarker` is already present, so re-running the generator doesn't duplicate the insert.
function insertBeforeClosingBrace(
	absPath: string,
	blockMarker: string,
	uniqueMarker: string,
	snippet: string,
): string {
	if (!fs.existsSync(absPath)) return `${relToRoot(absPath)} not found, skipped`;
	const raw = fs.readFileSync(absPath, "utf-8");
	if (raw.includes(uniqueMarker)) {
		return `${relToRoot(absPath)} already has this config`;
	}
	const markerIndex = raw.indexOf(blockMarker);
	if (markerIndex === -1) {
		throw new Error(`Could not find "${blockMarker}" in ${relToRoot(absPath)}`);
	}
	const openBraceIndex = raw.indexOf("{", markerIndex);
	const closeBraceIndex = findMatchingBracket(raw, openBraceIndex, "{", "}");
	const before = raw.slice(0, closeBraceIndex).replace(/\s*$/, "\n");
	fs.writeFileSync(absPath, `${before}${snippet}${raw.slice(closeBraceIndex)}`);
	return `${relToRoot(absPath)} (+${uniqueMarker})`;
}

// Adds kafka_brokers/schema_registry_url as overridable Terraform variables across all four
// per-server terraform files — module/{variables,main}.tf (the actual helm_release `set`
// blocks) and the thin standalone wrapper's {variables,main}.tf (pass-through) — mirroring how
// app_image_tag already flows through both layers. Lets a future multi-environment terraform
// config override the Kafka cluster this server points at without editing its Helm chart.
function addKafkaTerraformVars(location: string, name: string): string {
	const tfRoot = path.join(process.cwd(), location, "terraform");
	const tfVarsBlock =
		`\nvariable "kafka_brokers" {\n  description = "Kafka bootstrap brokers"\n` +
		`  type        = string\n  default     = "kafka.infra.svc.cluster.local:9092"\n}\n\n` +
		`variable "schema_registry_url" {\n  description = "Confluent Schema Registry URL"\n` +
		`  type        = string\n  default     = "http://schema-registry.infra.svc.cluster.local:8081"\n}\n`;

	function appendVars(absPath: string): string {
		if (!fs.existsSync(absPath)) return `${relToRoot(absPath)} not found, skipped`;
		const raw = fs.readFileSync(absPath, "utf-8");
		if (raw.includes('variable "kafka_brokers"')) {
			return `${relToRoot(absPath)} already has kafka_brokers`;
		}
		const separator = raw.endsWith("\n") ? "" : "\n";
		fs.writeFileSync(absPath, `${raw}${separator}${tfVarsBlock}`);
		return `${relToRoot(absPath)} (+kafka_brokers, +schema_registry_url)`;
	}

	const results = [
		appendVars(path.join(tfRoot, "module", "variables.tf")),
		insertBeforeClosingBrace(
			path.join(tfRoot, "module", "main.tf"),
			`resource "helm_release" "${name}"`,
			"kafka.brokers",
			`\n  set {\n    name  = "kafka.brokers"\n    value = var.kafka_brokers\n  }\n\n` +
				`  set {\n    name  = "schemaRegistry.url"\n    value = var.schema_registry_url\n  }\n`,
		),
		appendVars(path.join(tfRoot, "variables.tf")),
		insertBeforeClosingBrace(
			path.join(tfRoot, "main.tf"),
			`module "${name}"`,
			"kafka_brokers",
			`  kafka_brokers       = var.kafka_brokers\n  schema_registry_url = var.schema_registry_url\n`,
		),
	];
	return results.join("; ");
}

function registerActionTypes(plop: PlopTypes.NodePlopAPI): void {
	plop.setActionType("addKafkaPackageJson", (answers) => {
		const { location } = answers as { location: string };
		return mergeKafkaIntoPackageJson(path.join(process.cwd(), location, "package.json"));
	});

	plop.setActionType("appendKafkaEnv", (answers) => {
		const { location, role } = answers as { location: string; role: KafkaRole };
		const name = path.basename(location);
		const results = [
			appendKafkaEnv(path.join(process.cwd(), location, ".env.sample"), name, role, true),
			appendKafkaEnv(path.join(process.cwd(), location, ".env"), name, role, false),
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

	plop.setActionType("addKafkaHelmConfig", (answers) => {
		const { location, role } = answers as { location: string; role: KafkaRole };
		const name = path.basename(location);
		return [
			addKafkaHelmValues(location, name, role),
			addKafkaConfigmapEnv(location, role),
		].join("; ");
	});

	plop.setActionType("addKafkaTerraformConfig", (answers) => {
		const { location } = answers as { location: string };
		return addKafkaTerraformVars(location, path.basename(location));
	});

	plop.setActionType("wireKafkaDockerCompose", (answers) => {
		const { location, role } = answers as { location: string; role: KafkaRole };
		const name = path.basename(location);
		const environment: Record<string, string> = {
			KAFKA_BROKERS: "kafka:9092",
			SCHEMA_REGISTRY_URL: "http://schema-registry:8081",
		};
		if (role !== "producer") environment.KAFKA_GROUP_ID = `${name}-group`;
		return wireComposeService(location, name, {
			networks: ["kafka"],
			environment,
			dependsOn: { kafka: "service_healthy", "schema-registry": "service_healthy" },
		});
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
		{ type: "addKafkaHelmConfig" },
		{ type: "addKafkaTerraformConfig" },
		{ type: "wireKafkaDockerCompose" },
	],
};

export default KafkaGenerator;
