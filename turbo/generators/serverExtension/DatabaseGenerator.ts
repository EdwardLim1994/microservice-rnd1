import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addNamedImport,
	detectIndent,
	findMatchingBracket,
	wireComposeService,
	workspaceChoices,
} from "../helpers";

const PRISMA_VERSION = "^7.8.0";
const DEFAULT_DB_PORT = 5101;
const TEMPLATES_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "database");

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

// Adds `import { PrismaClient } from "../generated/prisma";` right after the last existing
// top-level import statement — a fresh import source, not a named import merged into an
// existing one, so addNamedImport (which requires a pre-existing `from "<source>"` line)
// doesn't apply here.
function addPrismaClientImport(raw: string): string {
	const importLine = 'import { PrismaClient } from "../generated/prisma";';
	if (raw.includes(importLine)) return raw;

	const importMatches = [...raw.matchAll(/^import\s[^;]*;$/gm)];
	const lastImport = importMatches.at(-1);
	if (!lastImport) {
		return `${importLine}\n${raw}`;
	}
	const insertAt = (lastImport.index ?? 0) + lastImport[0].length;
	return `${raw.slice(0, insertAt)}\n${importLine}${raw.slice(insertAt)}`;
}

// Inserts a chained builder call (e.g. `.database(PrismaClient, new PgAdapter(...))`) right
// after `ServerApp.init(...)`'s closing paren, before whatever chained call already follows it
// (`.containers(`, `.routers(`, `.run(`, ...) — same "find init(), locate its matching close
// paren" approach as helpers.ts's injectDriverEntry, but inserting a chained call rather than
// a driver array entry. Idempotent: skips if `marker` (e.g. "database") is already chained on.
function injectServerAppChainCall(absAppPath: string, marker: string, callText: string): string {
	let raw = fs.readFileSync(absAppPath, "utf-8");
	if (raw.includes(`.${marker}(`)) {
		return `${relToRoot(absAppPath)} already has .${marker}(...)`;
	}

	raw = addNamedImport(raw, "server", "PgAdapter");
	raw = addPrismaClientImport(raw);

	const initMarker = "ServerApp.init(";
	const initIndex = raw.indexOf(initMarker);
	if (initIndex === -1) {
		throw new Error(`Could not find "${initMarker}" in ${absAppPath}`);
	}
	const openParenIndex = initIndex + initMarker.length - 1;
	const closeParenIndex = findMatchingBracket(raw, openParenIndex, "(", ")");

	const indentMatch = /\n(\t+| +)await ServerApp\.init/.exec(raw);
	const baseIndent = indentMatch ? indentMatch[1] : "\t";
	const chainIndent = `${baseIndent}\t`;

	const insertAt = closeParenIndex + 1;
	// The base server template's fresh scaffold has `.run(...)` chained immediately after
	// `.init([])` on the same line (no other chain calls yet) — if what follows our insertion
	// point is still `.someCall(` with no line break, give it its own line too, instead of
	// leaving it dangling after our inserted call on the same line.
	let tail = raw.slice(insertAt);
	if (/^\./.test(tail)) {
		tail = `\n${chainIndent}${tail}`;
	}
	raw = `${raw.slice(0, insertAt)}\n${chainIndent}${callText}${tail}`;

	fs.writeFileSync(absAppPath, raw);
	return `${relToRoot(absAppPath)} (+.${marker}(...))`;
}

// Merges the prisma/@prisma packages + postinstall script into an existing package.json,
// preserving that file's own indentation style (servers are inconsistent: demo1 uses 2-space,
// demo2 uses tabs) and without clobbering an existing postinstall script.
function mergePrismaIntoPackageJson(absPackageJsonPath: string): string {
	const raw = fs.readFileSync(absPackageJsonPath, "utf-8");
	const indent = detectIndent(raw);
	const pkg = JSON.parse(raw);

	pkg.devDependencies ??= {};
	pkg.dependencies ??= {};
	pkg.scripts ??= {};

	pkg.devDependencies.prisma = PRISMA_VERSION;
	pkg.dependencies["@prisma/client"] = PRISMA_VERSION;
	pkg.dependencies["@prisma/client-runtime-utils"] = PRISMA_VERSION;

	const existingPostinstall = pkg.scripts.postinstall as string | undefined;
	if (!existingPostinstall) {
		pkg.scripts.postinstall = "prisma generate";
	} else if (!existingPostinstall.includes("prisma generate")) {
		pkg.scripts.postinstall = `${existingPostinstall} && prisma generate`;
	}

	fs.writeFileSync(absPackageJsonPath, `${JSON.stringify(pkg, null, indent)}\n`);
	return `${relToRoot(absPackageJsonPath)} (+prisma, @prisma/client, @prisma/client-runtime-utils, postinstall)`;
}

// Appends DATABASE_URL to .env.sample (creating it if somehow missing) and, only if it
// already exists, to .env too — .env is gitignored and may not exist in a fresh checkout.
function appendDatabaseUrl(absPath: string, dbUrl: string, createIfMissing: boolean): string | null {
	if (!fs.existsSync(absPath)) {
		if (!createIfMissing) return null;
		fs.writeFileSync(absPath, `# Database\n${dbUrl}\n`);
		return `${relToRoot(absPath)} (created, +DATABASE_URL)`;
	}
	const existing = fs.readFileSync(absPath, "utf-8");
	if (existing.includes("DATABASE_URL=")) {
		return `${relToRoot(absPath)} already has DATABASE_URL`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absPath, `${existing}${separator}\n# Database\n${dbUrl}\n`);
	return `${relToRoot(absPath)} (+DATABASE_URL)`;
}

// Scans every servers/*/docker-compose.yml for a host port already bound to Postgres's
// container port (5432) and returns the lowest port >= DEFAULT_DB_PORT not already taken —
// e.g. demo1 has "5101:5432", so a second DB-enabled server gets 5102, not another 5101.
function findAvailableDbPort(root: string): number {
	const serversDir = path.join(root, "servers");
	const usedPorts = new Set<number>();

	if (fs.existsSync(serversDir)) {
		for (const entry of fs.readdirSync(serversDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const composePath = path.join(serversDir, entry.name, "docker-compose.yml");
			if (!fs.existsSync(composePath)) continue;
			const raw = fs.readFileSync(composePath, "utf-8");
			for (const match of raw.matchAll(/"(\d+):5432"/g)) {
				usedPorts.add(Number(match[1]));
			}
		}
	}

	let port = DEFAULT_DB_PORT;
	while (usedPorts.has(port)) port++;
	return port;
}

function ensureAdminerNetworkDeclared(raw: string): string {
	if (/^networks:\s*$/m.test(raw)) {
		if (/^\s{2}adminer:\s*$/m.test(raw)) return raw;
		return raw.replace(/^networks:\s*$/m, "networks:\n  adminer:");
	}
	return `${raw.replace(/\n+$/, "\n")}networks:\n  adminer:\n`;
}

// Injects the <name>-migrate/<name>-db services before the top-level `networks:` key if one
// exists, else appends them (plus a fresh `networks:` section) at the end of the file.
function injectDockerComposeServices(absComposePath: string, snippet: string, name: string): string {
	const raw = fs.readFileSync(absComposePath, "utf-8");
	if (raw.includes(`${name}-migrate:`)) {
		return `${relToRoot(absComposePath)} already has database services`;
	}

	const networksMatch = raw.match(/^networks:\s*$/m);
	const before = (
		networksMatch?.index !== undefined ? raw.slice(0, networksMatch.index) : raw
	).replace(/\n+$/, "\n\n");
	const after =
		networksMatch?.index !== undefined ? raw.slice(networksMatch.index) : "networks:\n  adminer:\n";

	const next = ensureAdminerNetworkDeclared(`${before}${snippet}\n\n${after}`);

	fs.writeFileSync(absComposePath, next);
	return `${relToRoot(absComposePath)} (+${name}-migrate, +${name}-db)`;
}

// Injects the "migrate" build stage right before the "# ── runtime" stage marker, matching
// its position in servers/demo1/Dockerfile.
function injectDockerfileMigrateStage(absDockerfilePath: string, snippet: string): string {
	const raw = fs.readFileSync(absDockerfilePath, "utf-8");
	if (raw.includes("AS migrate")) {
		return `${relToRoot(absDockerfilePath)} already has a migrate stage`;
	}

	const marker = "# ── runtime";
	const markerIndex = raw.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(`Could not find "${marker}" marker in ${absDockerfilePath}`);
	}

	const before = raw.slice(0, markerIndex).replace(/\n+$/, "\n\n");
	const next = `${before}${snippet}\n\n${raw.slice(markerIndex)}`;

	fs.writeFileSync(absDockerfilePath, next);
	return `${relToRoot(absDockerfilePath)} (+migrate stage)`;
}

const POSTGRES_HELM_TEMPLATES_DIR = path.join(TEMPLATES_DIR, "helm");
const POSTGRES_HELM_FILES = [
	"postgres-deployment.yaml",
	"postgres-pvc.yaml",
	"postgres-service.yaml",
	"migration-job.yaml",
];

// Copies the postgres-deployment/-pvc/-service.yaml + migration-job.yaml templates into
// <location>/helm/templates/ verbatim — real Helm Go-template syntax (`{{ .Values... }}`,
// `{{ include ... }}`), not Handlebars, so a plain file copy (not plop's "add"/Handlebars
// compilation, which would choke on it — see helpers.ts's copyWithSubstitutions doc comment for
// the same gotcha) — and no `{{ name }}` substitution needed either, since every resource name
// in these files is derived from Helm's own "server.fullname" (the release name), not hardcoded.
function copyPostgresHelmTemplates(location: string): string {
	const destDir = path.join(process.cwd(), location, "helm", "templates");
	const results = POSTGRES_HELM_FILES.map((file) => {
		const destPath = path.join(destDir, file);
		if (fs.existsSync(destPath)) {
			return null;
		}
		fs.mkdirSync(destDir, { recursive: true });
		fs.copyFileSync(path.join(POSTGRES_HELM_TEMPLATES_DIR, file), destPath);
		return file;
	}).filter((file): file is string => file !== null);

	if (results.length === 0) {
		return `${relToRoot(destDir)} already has postgres templates`;
	}
	return `${relToRoot(destDir)} (+${results.join(", +")})`;
}

// Inserts a `migrate:` sibling of `image.app` in helm/values.yaml — the separate image
// migration-job.yaml's Job runs (built from the Dockerfile's "migrate" stage, see
// injectMigrateImageBuildStep below), distinct from the app Deployment's own `image.app`.
// Anchored on `  pullPolicy:` (image's other fixed sibling key in the base server template) since
// that's simpler than computing the `image:` block's own indented-body boundary just for one
// insertion point.
function addDatabaseImageMigrateValue(raw: string, name: string): string {
	if (/^\s{2}migrate:/m.test(raw)) return raw;
	const marker = /^(\s{2}pullPolicy:.*\n)/m;
	if (!marker.test(raw)) return raw;
	return raw.replace(marker, `  migrate:\n    repository: ${name}-migrate\n    tag: local\n$1`);
}

// Appends a `postgres:` block (image/credentials/storage for postgres-deployment.yaml) to
// helm/values.yaml — a brand-new top-level key, so (unlike image.migrate above) just appends at
// the end of the file, same pattern as KafkaGenerator's addKafkaHelmValues.
function addDatabaseHelmValues(location: string, name: string): string {
	const absPath = path.join(process.cwd(), location, "helm", "values.yaml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	let raw = fs.readFileSync(absPath, "utf-8");
	if (raw.includes("\npostgres:")) {
		return `${relToRoot(absPath)} already has postgres config`;
	}

	raw = addDatabaseImageMigrateValue(raw, name);

	const postgresBlock =
		`\n# Self-contained Postgres for this server alone (postgres-deployment.yaml/-pvc.yaml/\n` +
		`# -service.yaml) — mirrors docker-compose.yml's ${name}-db, not a shared cluster-wide\n` +
		`# database the way Kafka/Schema Registry are. Deliberately plain env-var credentials, no\n` +
		`# Secret — matches this chart's existing simplicity level; revisit if this ever needs to be\n` +
		`# more than a local/demo deployment.\n` +
		`postgres:\n  image: postgres:15.3-alpine\n  user: myuser\n  password: mypassword\n` +
		`  database: ${name}\n  storageSize: 1Gi\n`;

	const separator = raw.endsWith("\n") ? "" : "\n";
	fs.writeFileSync(absPath, `${raw}${separator}${postgresBlock}`);
	return `${relToRoot(absPath)} (+image.migrate, +postgres)`;
}

// Appends DATABASE_URL to helm/templates/configmap.yaml, pointing at postgres-service.yaml's
// Service — same pattern as KafkaGenerator's addKafkaConfigmapEnv.
function addDatabaseConfigmapEnv(location: string): string {
	const absPath = path.join(process.cwd(), location, "helm", "templates", "configmap.yaml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	const raw = fs.readFileSync(absPath, "utf-8");
	if (raw.includes("DATABASE_URL")) {
		return `${relToRoot(absPath)} already has DATABASE_URL`;
	}
	const line =
		`  # postgres-service.yaml's Service name — see its own comment for why this is a\n` +
		`  # dedicated per-server Postgres instead of a shared in-cluster one.\n` +
		`  DATABASE_URL: "postgresql://{{ .Values.postgres.user }}:{{ .Values.postgres.password }}` +
		`@{{ include "server.fullname" . }}-postgres:5432/{{ .Values.postgres.database }}"\n`;
	const separator = raw.endsWith("\n") ? "" : "\n";
	fs.writeFileSync(absPath, `${raw}${separator}${line}`);
	return `${relToRoot(absPath)} (+DATABASE_URL)`;
}

// Appends a second `docker build --target migrate` invocation to package.json's "k8s:build"
// script — the app image and the migration Job's image are two separate builds from the same
// Dockerfile (see servers/test1/package.json's k8s:build for the concrete two-build shape this
// follows).
function addMigrateImageBuildStep(absPackageJsonPath: string, location: string, name: string): string {
	const raw = fs.readFileSync(absPackageJsonPath, "utf-8");
	const indent = detectIndent(raw);
	const pkg = JSON.parse(raw);

	const existing = pkg.scripts?.["k8s:build"] as string | undefined;
	if (!existing) {
		return `${relToRoot(absPackageJsonPath)} has no "k8s:build" script, skipped`;
	}
	if (existing.includes("--target migrate")) {
		return `${relToRoot(absPackageJsonPath)} k8s:build already builds a migrate image`;
	}

	const migrateBuild = `docker build -f ${location}/Dockerfile --target migrate -t ${name}-migrate:local .`;
	pkg.scripts["k8s:build"] = `${existing} && ${migrateBuild}`;

	fs.writeFileSync(absPackageJsonPath, `${JSON.stringify(pkg, null, indent)}\n`);
	return `${relToRoot(absPackageJsonPath)} (k8s:build +migrate image)`;
}

export default class DatabaseGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		plop.setActionType("addPrismaPackageJson", (answers) => {
			const { location } = answers as { location: string };
			return mergePrismaIntoPackageJson(path.join(process.cwd(), location, "package.json"));
		});

		plop.setActionType("appendDatabaseEnv", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const port = findAvailableDbPort(process.cwd());
			const dbUrl = `DATABASE_URL=postgresql://myuser:mypassword@localhost:${port}/${name}`;
			const results = [
				appendDatabaseUrl(path.join(process.cwd(), location, ".env.sample"), dbUrl, true),
				appendDatabaseUrl(path.join(process.cwd(), location, ".env"), dbUrl, false),
			].filter((result): result is string => result !== null);
			return results.length > 0 ? results.join("; ") : "no .env files updated";
		});

		plop.setActionType("injectDatabaseDockerCompose", (answers, _config, plopApi) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const port = findAvailableDbPort(process.cwd());
			const template = fs.readFileSync(
				path.join(TEMPLATES_DIR, "docker-compose-snippet.hbs"),
				"utf-8",
			);
			const snippet = plopApi.renderString(template, { name, port });
			return injectDockerComposeServices(
				path.join(process.cwd(), location, "docker-compose.yml"),
				snippet,
				name,
			);
		});

		plop.setActionType("injectDatabaseDockerfile", (answers) => {
			const { location } = answers as { location: string };
			const snippet = fs.readFileSync(
				path.join(TEMPLATES_DIR, "dockerfile-migrate-stage.hbs"),
				"utf-8",
			);
			return injectDockerfileMigrateStage(
				path.join(process.cwd(), location, "Dockerfile"),
				snippet,
			);
		});

		plop.setActionType("injectDatabaseIntoServerApp", (answers) => {
			const { location } = answers as { location: string };
			const absAppPath = path.join(process.cwd(), location, "src", "app.ts");
			return injectServerAppChainCall(
				absAppPath,
				"database",
				".database(PrismaClient, new PgAdapter(import.meta.env.DATABASE_URL!))",
			);
		});

		plop.setActionType("wireDatabaseDockerCompose", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return wireComposeService(location, name, {
				networks: ["adminer"],
				environment: {
					DATABASE_URL: `postgresql://myuser:mypassword@${name}-db:5432/${name}`,
				},
				dependsOn: { [`${name}-db`]: "service_healthy" },
			});
		});

		plop.setActionType("addDatabaseHelmTemplates", (answers) => {
			const { location } = answers as { location: string };
			return copyPostgresHelmTemplates(location);
		});

		plop.setActionType("addDatabaseHelmConfig", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return [addDatabaseHelmValues(location, name), addDatabaseConfigmapEnv(location)].join("; ");
		});

		plop.setActionType("addDatabaseMigrateImageBuild", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return addMigrateImageBuildStep(path.join(process.cwd(), location, "package.json"), location, name);
		});

		plop.setGenerator("database", {
			description:
				"Add Prisma/Postgres support to an existing server: package.json deps, prisma.config.ts, schema.prisma, .env(.sample), docker-compose.yml + Dockerfile migrate stage, wires .database(PrismaClient, new PgAdapter(...)) into app.ts, and adds a self-contained in-cluster Postgres (Deployment/PVC/Service + migration Job) to the server's helm chart",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						serverWorkspaces,
						"No server workspaces without an existing database found under servers/**",
					),
				},
			],
			actions: [
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/prisma.config.ts",
					templateFile: "templates/database/prisma.config.ts.hbs",
				},
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/schemas/prisma/schema.prisma",
					templateFile: "templates/database/schema.prisma.hbs",
				},
				{ type: "addPrismaPackageJson" },
				{ type: "appendDatabaseEnv" },
				{ type: "injectDatabaseDockerCompose" },
				{ type: "wireDatabaseDockerCompose" },
				{ type: "injectDatabaseDockerfile" },
				{ type: "injectDatabaseIntoServerApp" },
				{ type: "addDatabaseHelmTemplates" },
				{ type: "addDatabaseHelmConfig" },
				{ type: "addDatabaseMigrateImageBuild" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new DatabaseGenerator(plop, serverWorkspaces);
	}
}
