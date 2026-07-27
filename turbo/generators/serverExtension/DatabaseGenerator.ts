import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addNamedImport,
	collapseTrailingNewlines,
	detectIndent,
	findMatchingBracket,
	wireHelmDeploymentConfigMap,
	workspaceChoices,
} from "../helpers";

const PRISMA_VERSION = "^7.8.0";
const DEFAULT_DB_PORT = 5101;
const TEMPLATES_DIR = path.join(
	process.cwd(),
	"turbo",
	"generators",
	"templates",
	"database",
);

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

/**
 * Adds `import { PrismaClient } from "../generated/prisma";` right after the last existing
 * top-level import statement — a fresh import source, not a named import merged into an
 * existing one, so addNamedImport (which requires a pre-existing `from "<source>"` line)
 * doesn't apply here.
 */
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

/**
 * Inserts a chained builder call (e.g. `.database(PrismaClient, new PgAdapter(...))`) right
 * after `ServerApp.init(...)`'s closing paren, before whatever chained call already follows it
 * (`.containers(`, `.routers(`, `.run(`, ...) — same "find init(), locate its matching close
 * paren" approach as helpers.ts's injectDriverEntry, but inserting a chained call rather than
 * a driver array entry. Idempotent: skips if `marker` (e.g. "database") is already chained on.
 */
function injectServerAppChainCall(
	absAppPath: string,
	marker: string,
	callText: string,
): string {
	let raw = fs.readFileSync(absAppPath, "utf-8");
	if (raw.includes(`.${marker}(`)) {
		return `${relToRoot(absAppPath)} already has .${marker}(...)`;
	}

	raw = addNamedImport(raw, "server", "VaultPgAdapter");
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
	if (tail.startsWith(".")) {
		tail = `\n${chainIndent}${tail}`;
	}
	raw = `${raw.slice(0, insertAt)}\n${chainIndent}${callText}${tail}`;

	fs.writeFileSync(absAppPath, raw);
	return `${relToRoot(absAppPath)} (+.${marker}(...))`;
}

/**
 * Merges the prisma/@prisma packages + postinstall script into an existing package.json,
 * preserving that file's own indentation style (servers are inconsistent: demo1 uses 2-space,
 * demo2 uses tabs) and without clobbering an existing postinstall script.
 */
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

	fs.writeFileSync(
		absPackageJsonPath,
		`${JSON.stringify(pkg, null, indent)}\n`,
	);
	return `${relToRoot(absPackageJsonPath)} (+prisma, @prisma/client, @prisma/client-runtime-utils, postinstall)`;
}

/**
 * VaultPgAdapter.fromEnv() needs the pieces to build a connection string around Vault's returned
 * username/password (DB_HOST/DB_PORT/DB_NAME) plus how to reach/authenticate to Vault itself
 * (VAULT_ADDR/VAULT_DB_ROLE — VAULT_ROLE_ID/VAULT_SECRET_ID are written separately by
 * services/vault/ansible's provisioning role once it's actually been run, not by this generator).
 * DATABASE_URL is still required alongside these — prisma.config.ts (createPrismaConfig()) reads
 * it directly for Prisma CLI operations (generate/migrate), which need a static connection
 * regardless of Vault. It's the same static superuser already scaffolded for <name>-db, and also
 * the value to pass into `new PgAdapter(process.env.DATABASE_URL!)` for the manual "switch to
 * root for testing" override documented in packages/server/CLAUDE.md's Database section.
 */
function buildDatabaseEnvBlock(name: string, port: number): string {
	return (
		`# Database (Vault-backed at runtime — see packages/server/CLAUDE.md's Database section).\n` +
		`# DATABASE_URL is still required by prisma.config.ts for Prisma CLI operations.\n` +
		`DATABASE_URL=postgresql://myuser:mypassword@localhost:${port}/${name}\n` +
		`DB_HOST=localhost\n` +
		`DB_PORT=${port}\n` +
		`DB_NAME=${name}\n` +
		`VAULT_ADDR=http://localhost:8200\n` +
		`VAULT_DB_ROLE=${name}-role\n`
	);
}

/**
 * Appends the Vault-backed database env block to .env.sample (creating it if somehow missing)
 * and, only if it already exists, to .env too — .env is gitignored and may not exist in a fresh
 * checkout.
 */
function appendDatabaseEnvBlock(
	absPath: string,
	block: string,
	createIfMissing: boolean,
): string | null {
	if (!fs.existsSync(absPath)) {
		if (!createIfMissing) return null;
		fs.writeFileSync(absPath, block);
		return `${relToRoot(absPath)} (created, +DB_HOST/DB_PORT/DB_NAME/VAULT_ADDR/VAULT_DB_ROLE)`;
	}
	const existing = fs.readFileSync(absPath, "utf-8");
	if (existing.includes("DB_HOST=")) {
		return `${relToRoot(absPath)} already has DB_HOST`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absPath, `${existing}${separator}\n${block}`);
	return `${relToRoot(absPath)} (+DB_HOST/DB_PORT/DB_NAME/VAULT_ADDR/VAULT_DB_ROLE)`;
}

/**
 * Scans every apps/servers/* /Tiltfile for a host port-forward already bound to Postgres's
 * container port (5432) and returns the lowest port >= DEFAULT_DB_PORT not already taken —
 * e.g. demo1 has "5101:5432", so a second DB-enabled server gets 5102, not another 5101. In
 * k8s this port only matters for host-side `prisma` CLI access via Tilt's port-forward — the
 * server's own Deployment/migrate Job reach the DB in-cluster via the `<name>-db` Service, no
 * host port involved.
 */
function findAvailableDbPort(root: string): number {
	const serversDir = path.join(root, "apps", "servers");
	const usedPorts = new Set<number>();

	if (fs.existsSync(serversDir)) {
		for (const entry of fs.readdirSync(serversDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const tiltfilePath = path.join(serversDir, entry.name, "Tiltfile");
			if (!fs.existsSync(tiltfilePath)) continue;
			const raw = fs.readFileSync(tiltfilePath, "utf-8");
			for (const match of raw.matchAll(/"(\d+):5432"/g)) {
				usedPorts.add(Number(match[1]));
			}
		}
	}

	let port = DEFAULT_DB_PORT;
	while (usedPorts.has(port)) port++;
	return port;
}

/**
 * Writes the <name>-db chart (Postgres Deployment/Service/PVC/Secret + the <name>-migrate Job)
 * into this server's own helm/templates/ — the k8s equivalent of docker-compose's <name>-db and
 * <name>-migrate one-off services.
 */
function writeDatabaseHelmChart(
	absHelmTemplatesDir: string,
	snippet: string,
	name: string,
): string {
	const destPath = path.join(absHelmTemplatesDir, "db.yaml");
	if (fs.existsSync(destPath)) {
		return `${relToRoot(destPath)} already exists`;
	}
	fs.mkdirSync(absHelmTemplatesDir, { recursive: true });
	fs.writeFileSync(destPath, snippet);
	return `${relToRoot(destPath)} (+${name}-db, +${name}-migrate)`;
}

/**
 * Appends the <name>-migrate image build + <name>-db k8s_resource port-forward to this server's
 * own Tiltfile — the docker_build has to target the Dockerfile's "migrate" stage specifically
 * (see dockerfile-migrate-stage.hbs), a second image alongside the server's own runtime image.
 */
function appendDatabaseTiltfile(
	absTiltfilePath: string,
	name: string,
	port: number,
): string {
	const raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (raw.includes(`${name}-db`)) {
		return `${relToRoot(absTiltfilePath)} already has database resources`;
	}
	const snippet =
		`\ndocker_build("${name}-migrate", "apps/servers/${name}", target="migrate")\n\n` +
		`k8s_resource(\n    "${name}-db",\n    port_forwards=["${port}:5432"],\n    labels=["servers"],\n)\n`;
	fs.writeFileSync(
		absTiltfilePath,
		`${collapseTrailingNewlines(raw)}\n${snippet}`,
	);
	return `${relToRoot(absTiltfilePath)} (+${name}-db, +${name}-migrate)`;
}

/**
 * Injects the "migrate" build stage right before the "# ── runtime" stage marker, matching
 * its position in servers/demo1/Dockerfile.
 */
function injectDockerfileMigrateStage(
	absDockerfilePath: string,
	snippet: string,
): string {
	const raw = fs.readFileSync(absDockerfilePath, "utf-8");
	if (raw.includes("AS migrate")) {
		return `${relToRoot(absDockerfilePath)} already has a migrate stage`;
	}

	const marker = "# ── runtime";
	const markerIndex = raw.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(
			`Could not find "${marker}" marker in ${absDockerfilePath}`,
		);
	}

	const before = collapseTrailingNewlines(raw.slice(0, markerIndex), 2);
	const next = `${before}${snippet}\n\n${raw.slice(markerIndex)}`;

	fs.writeFileSync(absDockerfilePath, next);
	return `${relToRoot(absDockerfilePath)} (+migrate stage)`;
}

export default class DatabaseGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		plop.setActionType("addPrismaPackageJson", (answers) => {
			const { location } = answers as { location: string };
			return mergePrismaIntoPackageJson(
				path.join(process.cwd(), location, "package.json"),
			);
		});

		plop.setActionType("appendDatabaseEnv", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const port = findAvailableDbPort(process.cwd());
			const block = buildDatabaseEnvBlock(name, port);
			const results = [
				appendDatabaseEnvBlock(
					path.join(process.cwd(), location, ".env.sample"),
					block,
					true,
				),
				appendDatabaseEnvBlock(
					path.join(process.cwd(), location, ".env"),
					block,
					false,
				),
			].filter((result): result is string => result !== null);
			return results.length > 0 ? results.join("; ") : "no .env files updated";
		});

		// Ansible vars file for services/vault/ansible's provisioning role — must run before
		// injectDatabaseHelm, since both call findAvailableDbPort and rely on the Tiltfile not
		// having the port written yet for the two calls to agree.
		//
		// ponytail: vault:provision below still runs via `docker compose run` against
		// services/vault/docker-compose.yml's "ansible" container on the Docker "vault"/"adminer"
		// networks — that only resolves "vault"/"<name>-db" hostnames if those compose backups are
		// actually running alongside the k8s ones. Once Vault + this server's DB run purely in
		// Tilt's cluster (no docker-compose backup up), this script can't reach either by that
		// hostname. Fix: a k8s Job running ansible-playbook in-cluster (real k8s DNS access), swap
		// in when the docker-compose backups actually get retired.
		plop.setActionType("addVaultAnsibleVars", (answers, _config, plopApi) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const port = findAvailableDbPort(process.cwd());
			const destPath = path.join(
				process.cwd(),
				location,
				"ansible",
				"vars.yml",
			);

			const results: string[] = [];
			if (fs.existsSync(destPath)) {
				results.push(`${relToRoot(destPath)} already exists`);
			} else {
				const template = fs.readFileSync(
					path.join(TEMPLATES_DIR, "vault-vars.yml.hbs"),
					"utf-8",
				);
				const rendered = plopApi.renderString(template, { name, port });
				fs.mkdirSync(path.dirname(destPath), { recursive: true });
				fs.writeFileSync(destPath, rendered);
				results.push(relToRoot(destPath));
			}

			const pkgPath = path.join(process.cwd(), location, "package.json");
			const raw = fs.readFileSync(pkgPath, "utf-8");
			const indent = detectIndent(raw);
			const pkg = JSON.parse(raw);
			pkg.scripts ??= {};
			if (!pkg.scripts["vault:provision"]) {
				// `cd ../..` first since `docker compose run` must run from wherever
				// docker-compose.yml's `include:` resolves from (repo root), not this server's own
				// directory — the "ansible" runner container (services/vault/docker-compose.yml)
				// mounts the repo root at /workspace, so paths below are relative to that, not to
				// this server's directory. No local ansible-core/hvac install needed on the host.
				pkg.scripts["vault:provision"] =
					`cd ../.. && docker compose run --rm ansible ansible-playbook services/vault/ansible/provision.yml -e @${location}/ansible/vars.yml`;
				fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, indent)}\n`);
				results.push(`${relToRoot(pkgPath)} (+vault:provision script)`);
			}

			return results.join("; ");
		});

		plop.setActionType("injectDatabaseHelm", (answers, _config, plopApi) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const port = findAvailableDbPort(process.cwd());
			const template = fs.readFileSync(
				path.join(TEMPLATES_DIR, "helm-db.yaml.hbs"),
				"utf-8",
			);
			const snippet = plopApi.renderString(template, { name, port });
			const chartResult = writeDatabaseHelmChart(
				path.join(process.cwd(), location, "helm", "templates"),
				snippet,
				name,
			);
			const tiltResult = appendDatabaseTiltfile(
				path.join(process.cwd(), location, "Tiltfile"),
				name,
				port,
			);
			return `${chartResult}; ${tiltResult}`;
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
				".database(PrismaClient, () => VaultPgAdapter.fromEnv())",
			);
		});

		plop.setActionType("wireDatabaseHelmDeployment", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return wireHelmDeploymentConfigMap(
				path.join(
					process.cwd(),
					location,
					"helm",
					"templates",
					"deployment.yaml",
				),
				`${name}-env`,
			);
		});

		plop.setGenerator("database", {
			description:
				"Add Prisma/Postgres support to an existing server: package.json deps, prisma.config.ts, schema.prisma, .env(.sample), a <name>-db helm chart (Postgres Deployment/Service/PVC/Secret + <name>-migrate Job) + Tiltfile wiring + Dockerfile migrate stage, wires .database(PrismaClient, VaultPgAdapter.fromEnv()) into app.ts (Vault-issued, short-lived Postgres credentials by default — see packages/server/CLAUDE.md's Database section for the manual root-credential testing override), and an Ansible vars file + vault:provision script for services/vault/ansible's provisioning role",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						serverWorkspaces,
						"No server workspaces without an existing database found under apps/servers/**",
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
				{ type: "addVaultAnsibleVars" },
				{ type: "injectDatabaseHelm" },
				{ type: "wireDatabaseHelmDeployment" },
				{ type: "injectDatabaseDockerfile" },
				{ type: "injectDatabaseIntoServerApp" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new DatabaseGenerator(plop, serverWorkspaces);
	}
}
