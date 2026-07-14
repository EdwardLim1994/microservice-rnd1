import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { findMatchingBracket } from "../helpers";

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

function schemaPathFor(location: string): string {
	return path.join(
		process.cwd(),
		location,
		"src",
		"schemas",
		"prisma",
		"schema.prisma",
	);
}

// Parses `model Foo { ... }` blocks out of a server's own schema.prisma to drive the table-choice
// prompt below — returns [] for a freshly-scaffolded server (turbo/generators/templates/database/
// schema.prisma.hbs has no models yet, since the developer hasn't defined any). Respects `@@map`
// (the actual Postgres table name, when a model's mapped away from its own name), since that's
// what Debezium's table.include.list needs to match, not the Prisma model name.
function parsePrismaModels(
	schemaPath: string,
): { model: string; table: string }[] {
	if (!fs.existsSync(schemaPath)) return [];
	const raw = fs.readFileSync(schemaPath, "utf-8");
	const results: { model: string; table: string }[] = [];
	const modelRegex = /model\s+(\w+)\s*\{/g;
	let match: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex-exec-in-while idiom
	while ((match = modelRegex.exec(raw))) {
		const openBraceIndex = match.index + match[0].length - 1;
		const closeBraceIndex = findMatchingBracket(raw, openBraceIndex, "{", "}");
		const body = raw.slice(openBraceIndex + 1, closeBraceIndex);
		const mapMatch = /@@map\(\s*"([^"]+)"\s*\)/.exec(body);
		results.push({ model: match[1], table: mapMatch ? mapMatch[1] : match[1] });
	}
	return results;
}

// Renders cdc_tables as a YAML flow sequence (e.g. `cdc_tables: ["public.Foo", "public.Bar"]`) —
// a real list, not a comma-joined string, so services/debezium/ansible/roles/provision-server-cdc
// can diff it against a publication's actual current membership with Jinja's `difference()`
// filter directly, no string-splitting.
function renderCdcTablesLine(tables: string[]): string {
	return `cdc_tables: [${tables.map((table) => JSON.stringify(table)).join(", ")}]`;
}

// Appends kafka_connect_addr/schema_registry_addr/cdc_tables to a server's own ansible/vars.yml
// (created by services/vault's DatabaseGenerator when the database extension was added) the first
// time this runs. kafka_connect_addr/schema_registry_addr never change once set, so they're
// skipped on a later run — but cdc_tables is expected to change every time a table is added or
// removed, so it's kept in sync in place on every run instead of being skipped alongside the rest
// (services/debezium/ansible's reconciliation tasks depend on cdc_tables actually reflecting the
// latest choice, not whatever was selected the first time `turbo gen cdc` ran).
function appendCdcVars(
	absVarsPath: string,
	serverName: string,
	kafkaConnectAddr: string,
	schemaRegistryAddr: string,
	tables: string[],
): string {
	const cdcTablesLine = renderCdcTablesLine(tables);

	if (!fs.existsSync(absVarsPath)) {
		const block =
			`\n# Reached from inside the "debezium-ansible" runner container\n` +
			`# (services/debezium/docker-compose.yml), which shares the "kafka" Docker network — NOT\n` +
			`# localhost:8083/localhost:8081 (only reachable from the host, not from another container).\n` +
			`# See services/debezium/CLAUDE.md.\n` +
			`kafka_connect_addr: ${kafkaConnectAddr}\n` +
			`schema_registry_addr: ${schemaRegistryAddr}\n` +
			`# Fully-qualified "schema.table" entries scoping which tables Debezium captures — empty\n` +
			`# captures every table. See services/debezium/ansible/roles/provision-server-cdc/defaults/\n` +
			`# main.yml for how this drives publication.autocreate.mode, and its tasks/main.yml for how\n` +
			`# changes here get reconciled against the publication's actual membership.\n` +
			`${cdcTablesLine}\n`;
		fs.mkdirSync(path.dirname(absVarsPath), { recursive: true });
		fs.writeFileSync(absVarsPath, `---\nserver_name: ${serverName}\n${block}`);
		return `${relToRoot(absVarsPath)} (created, +kafka_connect_addr, +schema_registry_addr, +cdc_tables)`;
	}

	const existing = fs.readFileSync(absVarsPath, "utf-8");
	if (!existing.includes("kafka_connect_addr:")) {
		const block =
			`\n# Reached from inside the "debezium-ansible" runner container\n` +
			`# (services/debezium/docker-compose.yml), which shares the "kafka" Docker network — NOT\n` +
			`# localhost:8083/localhost:8081 (only reachable from the host, not from another container).\n` +
			`# See services/debezium/CLAUDE.md.\n` +
			`kafka_connect_addr: ${kafkaConnectAddr}\n` +
			`schema_registry_addr: ${schemaRegistryAddr}\n` +
			`# Fully-qualified "schema.table" entries scoping which tables Debezium captures — empty\n` +
			`# captures every table. See services/debezium/ansible/roles/provision-server-cdc/defaults/\n` +
			`# main.yml for how this drives publication.autocreate.mode, and its tasks/main.yml for how\n` +
			`# changes here get reconciled against the publication's actual membership.\n` +
			`${cdcTablesLine}\n`;
		const separator = existing.endsWith("\n") ? "" : "\n";
		fs.writeFileSync(absVarsPath, `${existing}${separator}${block}`);
		return `${relToRoot(absVarsPath)} (+kafka_connect_addr, +schema_registry_addr, +cdc_tables)`;
	}

	if (/^cdc_tables:.*$/m.test(existing)) {
		const updated = existing.replace(/^cdc_tables:.*$/m, cdcTablesLine);
		if (updated === existing) {
			return `${relToRoot(absVarsPath)} cdc_tables already up to date`;
		}
		fs.writeFileSync(absVarsPath, updated);
		return `${relToRoot(absVarsPath)} (cdc_tables updated)`;
	}

	const separator = existing.endsWith("\n") ? "" : "\n";
	fs.writeFileSync(absVarsPath, `${existing}${separator}${cdcTablesLine}\n`);
	return `${relToRoot(absVarsPath)} (+cdc_tables)`;
}

// Inserts `command: ["postgres", "-c", "wal_level=logical"]` into a server's own <name>-db
// Postgres service, right after its POSTGRES_DB line and before `ports:` — the exact position
// servers/test1/docker-compose.yml uses, which itself matches
// turbo/generators/templates/database/docker-compose-snippet.hbs's own POSTGRES_DB/ports
// adjacency, so this anchor holds for every server DatabaseGenerator has scaffolded.
function injectWalLevelLogical(absComposePath: string, name: string): string {
	const raw = fs.readFileSync(absComposePath, "utf-8");
	if (raw.includes("wal_level=logical")) {
		return `${relToRoot(absComposePath)} already has wal_level=logical`;
	}
	const marker = new RegExp(String.raw`( {6}POSTGRES_DB: ${name}\n)( {4}ports:)`);
	const match = marker.exec(raw);
	if (!match) {
		return `${relToRoot(absComposePath)} has no matching "${name}-db" POSTGRES_DB line, skipped`;
	}
	const commandBlock =
		`    # wal_level=logical is required for Debezium's Postgres connector (services/debezium) to\n` +
		`    # read the write-ahead log via a replication slot — the postgres image defaults to\n` +
		`    # "replica", enough for physical replication/backups but not logical decoding. Only\n` +
		`    # takes effect from container start (a running container with this unset needs a\n` +
		`    # restart).\n` +
		`    command: ["postgres", "-c", "wal_level=logical"]\n`;
	const next = `${raw.slice(0, match.index)}${match[1]}${commandBlock}${match[2]}${raw.slice(match.index + match[0].length)}`;
	fs.writeFileSync(absComposePath, next);
	return `${relToRoot(absComposePath)} (+wal_level=logical)`;
}

function addCdcProvisionScript(
	absPackageJsonPath: string,
	location: string,
): string {
	const raw = fs.readFileSync(absPackageJsonPath, "utf-8");
	const indentMatch = /\n([ \t]+)\S/.exec(raw);
	const indent = indentMatch ? indentMatch[1] : "\t";
	const pkg = JSON.parse(raw);
	pkg.scripts ??= {};

	if (pkg.scripts["cdc:provision"]) {
		return `${relToRoot(absPackageJsonPath)} already has cdc:provision script`;
	}
	// `cd ../..` first — same convention as vault:provision (see
	// servers/test1/package.json) and every "k8s:build" script, since `docker compose run` must
	// run from wherever docker-compose.yml's `include:` resolves from (repo root), not this
	// server's own directory. The "debezium-ansible" runner container
	// (services/debezium/docker-compose.yml) mounts the repo root at /workspace.
	pkg.scripts["cdc:provision"] =
		`cd ../.. && docker compose run --rm debezium-ansible ansible-playbook services/debezium/ansible/provision.yml -e @${location}/ansible/vars.yml`;
	fs.writeFileSync(
		absPackageJsonPath,
		`${JSON.stringify(pkg, null, indent)}\n`,
	);
	return `${relToRoot(absPackageJsonPath)} (+cdc:provision script)`;
}

export default class CdcGenerator {
	private constructor(
		plop: PlopTypes.NodePlopAPI,
		prismaServerWorkspaces: string[],
	) {
		plop.setActionType("addCdcAnsibleVars", (answers) => {
			const { location, tables, tablesFreeText } = answers as {
				location: string;
				tables?: string[];
				tablesFreeText?: string;
			};
			const name = path.basename(location);
			const resolvedTables = tables?.length
				? tables
				: (tablesFreeText ?? "")
						.split(",")
						.map((table) => table.trim())
						.filter(Boolean);
			return appendCdcVars(
				path.join(process.cwd(), location, "ansible", "vars.yml"),
				name,
				"http://kafka-connect:8083",
				"http://schema-registry:8081",
				resolvedTables,
			);
		});

		plop.setActionType("injectCdcDockerCompose", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return injectWalLevelLogical(
				path.join(process.cwd(), location, "docker-compose.yml"),
				name,
			);
		});

		plop.setActionType("addCdcProvisionScript", (answers) => {
			const { location } = answers as { location: string };
			return addCdcProvisionScript(
				path.join(process.cwd(), location, "package.json"),
				location,
			);
		});

		plop.setGenerator("cdc", {
			description:
				"Wire up Debezium Change Data Capture (services/debezium) for an existing Prisma-backed server: sets wal_level=logical on its Postgres service, adds/updates kafka_connect_addr/schema_registry_addr/cdc_tables in its Ansible vars, and adds a cdc:provision script that registers a Debezium Postgres connector scoped to whichever tables you pick (or every table, if none) — safe to re-run whenever the set of tables to capture changes",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices:
						prismaServerWorkspaces.length > 0
							? prismaServerWorkspaces
							: [
									{
										name: 'No server workspaces with a database found under servers/** — run the "database" extension generator first',
										value: "",
										disabled: true,
									},
								],
				},
				{
					type: "checkbox",
					name: "tables",
					message: "Tables to capture (select none to capture every table):",
					when: (answers: { location: string }) =>
						parsePrismaModels(schemaPathFor(answers.location)).length > 0,
					choices: (answers: { location: string }) =>
						parsePrismaModels(schemaPathFor(answers.location)).map(
							({ model, table }) => ({
								name: `${model} (table "${table}")`,
								value: `public.${table}`,
							}),
						),
				},
				{
					type: "input",
					name: "tablesFreeText",
					message:
						"schema.prisma has no models yet — tables to capture, comma-separated schema.table (leave blank to capture every table):",
					when: (answers: { location: string }) =>
						parsePrismaModels(schemaPathFor(answers.location)).length === 0,
				},
			],
			actions: [
				{ type: "addCdcAnsibleVars" },
				{ type: "injectCdcDockerCompose" },
				{ type: "addCdcProvisionScript" },
			],
		});
	}

	public static apply(
		plop: PlopTypes.NodePlopAPI,
		prismaServerWorkspaces: string[],
	) {
		return new CdcGenerator(plop, prismaServerWorkspaces);
	}
}
