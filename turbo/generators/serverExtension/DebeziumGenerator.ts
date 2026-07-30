import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { findMatchingBracket } from "../helpers";

const TEMPLATES_DIR = path.join(__dirname, "..", "templates", "database");

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

/**
 * Parses `model Foo { ... }` blocks out of a server's own schema.prisma to drive the table-choice
 * prompt below — respects `@@map` (the actual Postgres table name), since that's what both the
 * publication and Debezium's table.include.list need to match, not the Prisma model name.
 */
function parsePrismaModels(schemaPath: string): { model: string; table: string }[] {
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

/**
 * Eligible targets: servers with a db.yaml (the "database" extension already ran) that don't
 * have a debezium.yaml yet.
 */
function findServersEligibleForDebezium(root: string, prismaServerWorkspaces: string[]) {
	return prismaServerWorkspaces.filter((location) => {
		const templatesDir = path.join(root, location, "helm", "templates");
		return (
			fs.existsSync(path.join(templatesDir, "db.yaml")) &&
			!fs.existsSync(path.join(templatesDir, "debezium.yaml"))
		);
	});
}

/**
 * Patches the <name>-db chart's Postgres container so its WAL is actually readable by Debezium's
 * pgoutput plugin, and adds a docker-entrypoint-initdb.d script creating the publication pgoutput
 * needs (Debezium creates the replication slot itself but not the publication). Idempotent: skips
 * whichever half is already present, matched against the exact text turbo/generators/templates/
 * database/helm-db.yaml.hbs produces.
 */
export function patchDbForDebezium(
	absDbYamlPath: string,
	name: string,
	tables: string[],
): string {
	if (tables.length === 0) {
		throw new Error(
			"patchDbForDebezium requires at least one table — Debezium no longer defaults to " +
				"FOR ALL TABLES; pass the specific table(s) to capture (e.g. [\"public.item\"])",
		);
	}

	let raw = fs.readFileSync(absDbYamlPath, "utf-8");
	const results: string[] = [];

	if (!raw.includes("wal_level=logical")) {
		const marker = "          image: postgres:15.3-alpine\n";
		const index = raw.indexOf(marker);
		if (index === -1) {
			results.push("no matching postgres image line for wal_level args, skipped");
		} else {
			const argsBlock =
				`          # wal_level=logical + a replication slot/sender — required for Debezium Server's\n` +
				`          # pgoutput plugin to stream this database's WAL at all. Args only (no \`command:\`\n` +
				`          # override) so docker-entrypoint.sh's init logic still runs.\n` +
				`          args:\n` +
				`            - "-c"\n` +
				`            - "wal_level=logical"\n` +
				`            - "-c"\n` +
				`            - "max_replication_slots=4"\n` +
				`            - "-c"\n` +
				`            - "max_wal_senders=4"\n`;
			raw = `${raw.slice(0, index + marker.length)}${argsBlock}${raw.slice(index + marker.length)}`;
			results.push("+wal_level=logical");
		}
	}

	// The publication itself is NOT created here via docker-entrypoint-initdb.d — those scripts
	// run exactly once, at Postgres's very first boot, on an empty data dir, before the migrate
	// Job (an external k8s Job, applied and run separately) has any chance to create the
	// table(s) being published. `CREATE PUBLICATION ... FOR TABLE <table>` against a table that
	// doesn't exist yet fails outright every time — not a Tilt/ordering problem, initdb is
	// structurally the wrong place for this. See helm-debezium.yaml.hbs's own initContainer,
	// which creates the publication after the table is guaranteed to exist.

	fs.writeFileSync(absDbYamlPath, raw);
	return results.length > 0
		? `${relToRoot(absDbYamlPath)} (${results.join(", ")})`
		: `${relToRoot(absDbYamlPath)} already wired for Debezium`;
}

export function appendDebeziumTiltResource(absTiltfilePath: string, name: string): string {
	const raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (raw.includes(`${name}-debezium`)) {
		return `${relToRoot(absTiltfilePath)} already has ${name}-debezium resource`;
	}
	// Also depends on "${name}-migrate", not just "${name}-db": this Deployment's own
	// create-publication initContainer (see helm-debezium.yaml.hbs) needs the table(s) it
	// publishes to already exist, which only ${name}-migrate guarantees.
	const snippet =
		`\nk8s_resource(\n` +
		`    "${name}-debezium",\n` +
		`    resource_deps=["${name}-db", "${name}-migrate"],\n` +
		`    labels=["servers"],\n` +
		`)\n`;
	fs.writeFileSync(absTiltfilePath, `${raw.trimEnd()}\n${snippet}`);
	return `${relToRoot(absTiltfilePath)} (+${name}-debezium)`;
}

export default class DebeziumGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, prismaServerWorkspaces: string[]) {
		const eligible = findServersEligibleForDebezium(process.cwd(), prismaServerWorkspaces);

		const resolveTables = (answers: {
			location: string;
			tables?: string[];
			tablesFreeText?: string;
		}): string[] =>
			answers.tables?.length
				? answers.tables
				: (answers.tablesFreeText ?? "")
						.split(",")
						.map((table) => table.trim())
						.filter(Boolean);

		plop.setActionType("injectDebeziumHelm", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const tables = resolveTables(
				answers as { location: string; tables?: string[]; tablesFreeText?: string },
			);
			const template = fs.readFileSync(
				path.join(TEMPLATES_DIR, "helm-debezium.yaml.hbs"),
				"utf-8",
			);
			const destPath = path.join(
				process.cwd(),
				location,
				"helm",
				"templates",
				"debezium.yaml",
			);
			if (fs.existsSync(destPath)) {
				return `${relToRoot(destPath)} already exists`;
			}
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.writeFileSync(
				destPath,
				plop.renderString(template, {
					name,
					tableIncludeList: tables.join(","),
					// Debezium's table.include.list matches unquoted (case-sensitive JDBC metadata
					// comparison), but `CREATE PUBLICATION ... FOR TABLE` needs each table
					// double-quoted — Postgres folds an unquoted identifier to lowercase, which
					// silently stops matching a table whose real name has any uppercase (e.g. a
					// Prisma model with no @@map, which keeps the model's own casing).
					publicationTargets: tables
						.map((table) => {
							const [schema, tableName] = table.split(".");
							return `${schema}."${tableName}"`;
						})
						.join(", "),
				}),
			);
			return `${relToRoot(destPath)} (+${name}-debezium, scoped to ${tables.join(", ")})`;
		});

		plop.setActionType("patchDbForDebezium", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const tables = resolveTables(
				answers as { location: string; tables?: string[]; tablesFreeText?: string },
			);
			return patchDbForDebezium(
				path.join(process.cwd(), location, "helm", "templates", "db.yaml"),
				name,
				tables,
			);
		});

		plop.setActionType("appendDebeziumTiltfile", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return appendDebeziumTiltResource(
				path.join(process.cwd(), location, "Tiltfile"),
				name,
			);
		});

		plop.setGenerator("debezium", {
			description:
				"Optionally add a Debezium Server instance (services/debezium's replacement — one process per server, not a shared Kafka Connect cluster) capturing an existing server's own Postgres via pgoutput: adds a debezium.yaml Deployment+ConfigMap, patches its db.yaml for wal_level=logical + a publication init script scoped to the table(s) you pick, and wires the Tiltfile resource — at least one table is required, no more capturing every table by default",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices:
						eligible.length > 0
							? eligible
							: [
									{
										name: 'No eligible server workspaces found — needs the "database" extension already added, and no existing debezium.yaml',
										value: "",
										disabled: true,
									},
								],
				},
				{
					type: "checkbox",
					name: "tables",
					message: "Tables to capture (select at least one — no more capturing every table by default):",
					when: (answers: { location: string }) =>
						parsePrismaModels(schemaPathFor(answers.location)).length > 0,
					choices: (answers: { location: string }) =>
						parsePrismaModels(schemaPathFor(answers.location)).map(
							({ model, table }) => ({
								name: `${model} (table "${table}")`,
								value: `public.${table}`,
							}),
						),
					validate: (selected: string[]) =>
						selected.length > 0 ||
						"Pick at least one table — Debezium no longer defaults to capturing every table",
				},
				{
					type: "input",
					name: "tablesFreeText",
					message:
						"schema.prisma has no models yet — table(s) to capture, comma-separated (required, e.g. \"public.item\"):",
					when: (answers: { location: string }) =>
						parsePrismaModels(schemaPathFor(answers.location)).length === 0,
					validate: (value: string) =>
						value.split(",").some((table) => table.trim().length > 0) ||
						"At least one table is required — Debezium no longer defaults to capturing every table",
				},
			],
			actions: [
				{ type: "injectDebeziumHelm" },
				{ type: "patchDbForDebezium" },
				{ type: "appendDebeziumTiltfile" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, prismaServerWorkspaces: string[]) {
		return new DebeziumGenerator(plop, prismaServerWorkspaces);
	}
}
