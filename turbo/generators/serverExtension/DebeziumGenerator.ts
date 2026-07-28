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
	tables: string[] = [],
): string {
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

	if (!raw.includes("docker-entrypoint-initdb.d")) {
		const mountMarker =
			"            - name: data\n              mountPath: /var/lib/postgresql/data\n";
		const mountIndex = raw.indexOf(mountMarker);
		const volumeMarker = "        - name: data\n          emptyDir: {}\n";
		if (mountIndex === -1 || !raw.includes(volumeMarker)) {
			results.push("no matching volumeMounts/volumes anchor for initdb, skipped");
		} else {
			raw = `${raw.slice(0, mountIndex + mountMarker.length)}            - name: initdb\n              mountPath: /docker-entrypoint-initdb.d\n${raw.slice(mountIndex + mountMarker.length)}`;
			// volumes block sits after volumeMounts, so its index has shifted by the mount
			// edit above — re-find it post-edit instead of trusting a pre-edit offset.
			const volumeIndex = raw.indexOf(volumeMarker);
			const initdbVolume =
				"        - name: initdb\n          configMap:\n            name: " +
				`${name}-db-initdb\n`;
			raw = `${raw.slice(0, volumeIndex + volumeMarker.length)}${initdbVolume}${raw.slice(volumeIndex + volumeMarker.length)}`;
			const publicationTarget =
				tables.length > 0 ? `FOR TABLE ${tables.join(", ")}` : "FOR ALL TABLES";
			raw =
				`${raw.trimEnd()}\n\n` +
				`---\n` +
				`# docker-entrypoint.sh runs *.sql in /docker-entrypoint-initdb.d on first boot (empty data\n` +
				`# dir only) — creates the publication pgoutput needs; Debezium creates the replication\n` +
				`# slot itself but won't create this.\n` +
				`apiVersion: v1\n` +
				`kind: ConfigMap\n` +
				`metadata:\n` +
				`  name: ${name}-db-initdb\n` +
				`data:\n` +
				`  publication.sql: |\n` +
				`    CREATE PUBLICATION ${name}_debezium ${publicationTarget};\n`;
			results.push("+initdb publication.sql");
		}
	}

	fs.writeFileSync(absDbYamlPath, raw);
	return results.length > 0
		? `${relToRoot(absDbYamlPath)} (${results.join(", ")})`
		: `${relToRoot(absDbYamlPath)} already wired for Debezium`;
}

function appendDebeziumTiltResource(absTiltfilePath: string, name: string): string {
	const raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (raw.includes(`${name}-debezium`)) {
		return `${relToRoot(absTiltfilePath)} already has ${name}-debezium resource`;
	}
	const snippet =
		`\nk8s_resource(\n` +
		`    "${name}-debezium",\n` +
		`    resource_deps=["${name}-db"],\n` +
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
					tableIncludeList: tables.length > 0 ? tables.join(",") : undefined,
				}),
			);
			return `${relToRoot(destPath)} (+${name}-debezium${tables.length > 0 ? `, scoped to ${tables.join(", ")}` : ""})`;
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
				"Optionally add a Debezium Server instance (services/debezium's replacement — one process per server, not a shared Kafka Connect cluster) capturing an existing server's own Postgres via pgoutput: adds a debezium.yaml Deployment+ConfigMap, patches its db.yaml for wal_level=logical + a scoped (or FOR ALL TABLES) publication init script, and wires the Tiltfile resource",
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
						"schema.prisma has no models yet — tables to capture, comma-separated (leave blank to capture every table):",
					when: (answers: { location: string }) =>
						parsePrismaModels(schemaPathFor(answers.location)).length === 0,
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
