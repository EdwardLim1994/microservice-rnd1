import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { detectIndent, workspaceChoices } from "../helpers";

const PRISMA_VERSION = "^7.8.0";
const DEFAULT_DB_PORT = 5101;
const TEMPLATES_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "database");

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
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

		plop.setGenerator("database", {
			description:
				"Add Prisma/Postgres support to an existing server: package.json deps, prisma.config.ts, schema.prisma, .env(.sample), docker-compose.yml + Dockerfile migrate stage",
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
				{ type: "injectDatabaseDockerfile" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new DatabaseGenerator(plop, serverWorkspaces);
	}
}
