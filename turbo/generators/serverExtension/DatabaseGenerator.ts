import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addNamedImport,
	collapseTrailingNewlines,
	detectIndent,
	findMatchingBracket,
	wireHelmDeploymentConfigMap,
	wireHelmInitContainerWait,
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
 * Inserts `const databaseUrl = process.env.DATABASE_URL; if (!databaseUrl) throw ...` right
 * before the server's `export default async function main` — PgAdapter takes a plain connection
 * string, not an env lookup, so the required-var guard has to live at the call site instead of
 * inside an adapter factory. Idempotent: skips if already present.
 */
function addDatabaseUrlGuard(raw: string): string {
	const guard =
		"const databaseUrl = process.env.DATABASE_URL;\n" +
		'if (!databaseUrl) throw new Error("DATABASE_URL is required");\n\n';
	if (raw.includes("const databaseUrl")) return raw;

	const marker = "export default async function main";
	const markerIndex = raw.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(`Could not find "${marker}" marker`);
	}
	return `${raw.slice(0, markerIndex)}${guard}${raw.slice(markerIndex)}`;
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

	raw = addNamedImport(raw, "server", "PgAdapter");
	raw = addPrismaClientImport(raw);
	raw = addDatabaseUrlGuard(raw);

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
	// prisma.config.ts (below) imports createPrismaConfig from here — without this declared,
	// `turbo prune --docker` (Dockerfile's pruner stage) never includes packages/script in the
	// pruned build context at all, since it computes the subset from declared dependencies only.
	// Works locally anyway (a root `bun install` links every workspace regardless of what's
	// declared), which is exactly why this was missing until a real Docker build caught it.
	pkg.dependencies.script = "workspace:*";

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
	return `${relToRoot(absPackageJsonPath)} (+prisma, @prisma/client, @prisma/client-runtime-utils, script, postinstall)`;
}

/**
 * Static superuser creds — same one scaffolded for <name>-db's own container (see
 * helm-db.yaml.hbs) — passed straight into `new PgAdapter(databaseUrl)`. No Vault indirection;
 * DATABASE_URL is also read directly by prisma.config.ts (createPrismaConfig()) for Prisma CLI
 * operations (generate/migrate).
 */
function buildDatabaseEnvBlock(name: string, port: number): string {
	return (
		`# Database — static superuser creds, also read by prisma.config.ts for Prisma CLI\n` +
		`# operations (generate/migrate).\n` +
		`DATABASE_URL=postgresql://myuser:mypassword@localhost:${port}/${name}\n` +
		`DB_HOST=localhost\n` +
		`DB_PORT=${port}\n` +
		`DB_NAME=${name}\n`
	);
}

/**
 * Appends the database env block to .env.sample (creating it if somehow missing) and, only if it
 * already exists, to .env too — .env is gitignored and may not exist in a fresh checkout.
 */
function appendDatabaseEnvBlock(
	absPath: string,
	block: string,
	createIfMissing: boolean,
): string | null {
	if (!fs.existsSync(absPath)) {
		if (!createIfMissing) return null;
		fs.writeFileSync(absPath, block);
		return `${relToRoot(absPath)} (created, +DATABASE_URL/DB_HOST/DB_PORT/DB_NAME)`;
	}
	const existing = fs.readFileSync(absPath, "utf-8");
	if (existing.includes("DB_HOST=")) {
		return `${relToRoot(absPath)} already has DB_HOST`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absPath, `${existing}${separator}\n${block}`);
	return `${relToRoot(absPath)} (+DATABASE_URL/DB_HOST/DB_PORT/DB_NAME)`;
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
 * Adds a `sync()` for this server's own generated/ dir (Prisma client output — see
 * schema.prisma.hbs's `output` path) to the main docker_build's `live_update` list, right before
 * `restart_container()` — without it, the "development" stage's live_update never picks up a
 * freshly regenerated Prisma client. Idempotent: skips if a "generated" sync is already there.
 */
function injectGeneratedSync(absTiltfilePath: string, name: string): string {
	const raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (raw.includes("/generated\"")) {
		return `${relToRoot(absTiltfilePath)} already syncs generated/`;
	}

	const marker = "restart_container(),";
	const markerIndex = raw.indexOf(marker);
	if (markerIndex === -1) {
		return `${relToRoot(absTiltfilePath)} has no live_update to extend, skipped`;
	}

	const lineStart = raw.lastIndexOf("\n", markerIndex) + 1;
	const indent = raw.slice(lineStart, markerIndex).match(/^\s*/)?.[0] ?? "";
	const entry = `${indent}sync("apps/servers/${name}/generated", "/app/apps/servers/${name}/generated"),\n`;
	const next = `${raw.slice(0, lineStart)}${entry}${raw.slice(lineStart)}`;

	fs.writeFileSync(absTiltfilePath, next);
	return `${relToRoot(absTiltfilePath)} (+generated sync)`;
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
	injectGeneratedSync(absTiltfilePath, name);

	const raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (raw.includes(`${name}-db`)) {
		return `${relToRoot(absTiltfilePath)} already has database resources`;
	}
	const snippet =
		`\ndocker_build("${name}-migrate", "../../..", dockerfile="./Dockerfile", target="migrate")\n\n` +
		// "services-ready" (services/Tiltfile) gates this on every services/* resource actually
		// being up first — same reasoning as the "{name}" resource's own gate.
		`k8s_resource(\n    "${name}-db",\n    resource_deps=["services-ready"],\n    port_forwards=["${port}:5432"],\n    labels=["servers"],\n)\n\n` +
		// "${name}-migrate" (the Job) has no explicit k8s_resource() call otherwise, so it falls
		// into Tilt's default "unlabeled" UI bucket instead of grouping with everything else here.
		`k8s_resource(\n    "${name}-migrate",\n    resource_deps=["${name}-db"],\n    labels=["servers"],\n)\n\n` +
		// Tilt disambiguates same-named Job+CronJob pairs as "<name>:job"/"<name>:cronjob" — a
		// plain "${name}-db-provision" isn't a valid resource name here. Also depends on "${name}"
		// itself, not just "${name}-db": db-provision-main.sh ends with `kubectl rollout restart/
		// status deployment/${name}` with no retry loop of its own, so without this the Job can hit
		// "deployment ${name} not found" if it runs before ${name}'s own Deployment even exists yet
		// and burn through backoffLimit needing a manual re-trigger.
		`k8s_resource(\n    "${name}-db-provision:job",\n    resource_deps=["services-ready", "${name}-db", "${name}"],\n    labels=["servers"],\n)\n\n` +
		`k8s_resource(\n    "${name}-db-provision:cronjob",\n    resource_deps=["services-ready", "${name}-db", "${name}"],\n    labels=["servers"],\n)\n`;
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

/**
 * Adds an explicit `RUN bunx prisma generate` right after the builder stage's own WORKDIR line
 * (shared by every stage that branches off "builder" — development/migrate/compiled all need
 * generated/prisma/ to exist). Not left to the postinstall hook (`prisma generate` in
 * package.json, from mergePrismaIntoPackageJson) alone — that ran silently non-fatally on a
 * missing DATABASE_URL once already, producing an image with no generated client that only
 * failed later, at runtime ("Cannot find module '../generated/prisma'"), not at build time. A
 * dedicated RUN here fails the build loudly instead.
 */
function injectDockerfilePrismaGenerate(absDockerfilePath: string): string {
	const raw = fs.readFileSync(absDockerfilePath, "utf-8");
	if (raw.includes("RUN bunx prisma generate")) {
		return `${relToRoot(absDockerfilePath)} already has an explicit prisma generate`;
	}

	const marker = /^WORKDIR \/app\/apps\/servers\/.*\n/m;
	const match = marker.exec(raw);
	if (!match) {
		throw new Error(
			`Could not find the builder stage's WORKDIR line in ${absDockerfilePath}`,
		);
	}
	const insertAt = match.index + match[0].length;
	const snippet =
		"\n# Explicit, not relying on the postinstall hook `bun install`/`bun run build` may or may\n" +
		"# not have actually triggered above — that path failed silently once already (DATABASE_URL\n" +
		"# missing, non-fatal to the overall build) and left an image with no generated/prisma/ at\n" +
		"# all, crashing at runtime instead of at build time. A dedicated RUN here fails the build\n" +
		"# loudly if this ever breaks again, instead of shipping a broken image.\n" +
		"RUN bunx prisma generate\n";
	fs.writeFileSync(
		absDockerfilePath,
		`${raw.slice(0, insertAt)}${snippet}${raw.slice(insertAt)}`,
	);
	return `${relToRoot(absDockerfilePath)} (+explicit prisma generate)`;
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

		// Vault-backed dynamic Postgres creds for the app's own Deployment (see
		// helm-db-provision-job.yaml.hbs) — a post-install/post-upgrade hook Job plus a
		// recurring CronJob that mint a fresh leased role, patch it into <name>-secret, and roll
		// the Deployment. Written alongside <name>-db (db.yaml, from injectDatabaseHelm) rather
		// than folded into it, since it's a distinct concern (Vault provisioning vs. the DB
		// itself) with its own RBAC (a dedicated vault-db-provision ServiceAccount).
		plop.setActionType(
			"injectDatabaseProvisionJob",
			(answers, _config, plopApi) => {
				const { location } = answers as { location: string };
				const name = path.basename(location);
				const helmDir = path.join(process.cwd(), location, "helm");

				const jobTemplate = fs.readFileSync(
					path.join(TEMPLATES_DIR, "helm-db-provision-job.yaml.hbs"),
					"utf-8",
				);
				const jobSnippet = plopApi.renderString(jobTemplate, { name });
				const jobDestPath = path.join(
					helmDir,
					"templates",
					"db-provision-job.yaml",
				);

				// The scripts live under helm/files/, not helm/templates/ — see
				// helm-db-provision-job.yaml.hbs's header comment for why: Helm's `.Files.Get`
				// skips Go-templating this file's content entirely, letting Vault's own
				// `{{username}}`-style template placeholders reach the shell script literally.
				// Two scripts, not one — the Job/CronJob split into a vault-CLI initContainer and
				// a kubectl-only main container (neither image has both toolsets).
				const initDestPath = path.join(helmDir, "files", "db-provision-init.sh");
				const mainDestPath = path.join(helmDir, "files", "db-provision-main.sh");

				if (
					fs.existsSync(jobDestPath) ||
					fs.existsSync(initDestPath) ||
					fs.existsSync(mainDestPath)
				) {
					return `${relToRoot(jobDestPath)} already exists`;
				}
				fs.writeFileSync(jobDestPath, jobSnippet);
				fs.mkdirSync(path.dirname(initDestPath), { recursive: true });
				for (const [templateName, destPath] of [
					["db-provision-init.sh.hbs", initDestPath],
					["db-provision-main.sh.hbs", mainDestPath],
				] as const) {
					const template = fs.readFileSync(
						path.join(TEMPLATES_DIR, templateName),
						"utf-8",
					);
					fs.writeFileSync(destPath, plopApi.renderString(template, { name }));
				}
				return `${relToRoot(jobDestPath)}, ${relToRoot(initDestPath)}, ${relToRoot(mainDestPath)} (+${name}-db-provision Job/CronJob)`;
			},
		);

		plop.setActionType("injectDatabaseDockerfile", (answers) => {
			const { location } = answers as { location: string };
			const snippet = fs.readFileSync(
				path.join(TEMPLATES_DIR, "dockerfile-migrate-stage.hbs"),
				"utf-8",
			);
			const migrateResult = injectDockerfileMigrateStage(
				path.join(process.cwd(), location, "Dockerfile"),
				snippet,
			);
			const generateResult = injectDockerfilePrismaGenerate(
				path.join(process.cwd(), location, "Dockerfile"),
			);
			return `${migrateResult}; ${generateResult}`;
		});

		plop.setActionType("injectDatabaseIntoServerApp", (answers) => {
			const { location } = answers as { location: string };
			const absAppPath = path.join(process.cwd(), location, "src", "app.ts");
			return injectServerAppChainCall(
				absAppPath,
				"database",
				".database(PrismaClient, new PgAdapter(databaseUrl))",
			);
		});

		plop.setActionType("wireDatabaseHelmDeployment", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const deploymentPath = path.join(
				process.cwd(),
				location,
				"helm",
				"templates",
				"deployment.yaml",
			);
			const configMapResult = wireHelmDeploymentConfigMap(
				deploymentPath,
				`${name}-env`,
			);
			// DATABASE_URL lives in <name>-secret, not the <name>-env ConfigMap above — it holds
			// Vault-minted credentials (see helm-db-provision-job.yaml.hbs), rotated in place by
			// that Job/CronJob without this Deployment's envFrom ever changing.
			const secretResult = wireHelmDeploymentConfigMap(
				deploymentPath,
				`${name}-secret`,
				"secretRef",
			);
			// server1-db has no dependents that don't already retry/self-heal (see server1's own
			// deployment.yaml comment) except this app container itself — a Service has no
			// endpoints until its pod passes readinessProbe, so without this wait the app can boot
			// against a DB that isn't accepting connections yet.
			const waitResult = wireHelmInitContainerWait(
				deploymentPath,
				`wait-for-${name}-db`,
				"postgres:15.3-alpine",
				`until pg_isready -h ${name}-db -p 5432 -U myuser; do sleep 2; done`,
			);
			return `${configMapResult}; ${secretResult}; ${waitResult}`;
		});

		plop.setGenerator("database", {
			description:
				"Add Prisma/Postgres support to an existing server: package.json deps, prisma.config.ts, schema.prisma, .env(.sample), a <name>-db helm chart (Postgres Deployment/Service/ConfigMap + <name>-migrate Job) + Tiltfile wiring + Dockerfile migrate stage, wires .database(PrismaClient, new PgAdapter(databaseUrl)) into app.ts, and a <name>-db-provision Job/CronJob (helm-db-provision-job.yaml.hbs) that mints Vault-backed dynamic Postgres creds into <name>-secret by default — app.ts itself only ever reads DATABASE_URL, so no app-side Vault client code is needed (the old VaultPgAdapter approach); see services/vault/CLAUDE.md for the provisioning story",
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
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/helm/values.yaml",
					templateFile: "templates/database/values.yaml.hbs",
					skipIfExists: true,
				},
				{ type: "addPrismaPackageJson" },
				{ type: "appendDatabaseEnv" },
				{ type: "injectDatabaseHelm" },
				{ type: "injectDatabaseProvisionJob" },
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
