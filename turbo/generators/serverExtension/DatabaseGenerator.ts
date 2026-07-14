import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addNamedImport,
	collapseTrailingNewlines,
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

// VaultPgAdapter.fromEnv() needs the pieces to build a connection string around Vault's returned
// username/password (DB_HOST/DB_PORT/DB_NAME) plus how to reach/authenticate to Vault itself
// (VAULT_ADDR/VAULT_DB_ROLE — VAULT_ROLE_ID/VAULT_SECRET_ID are written separately by
// services/vault/ansible's provisioning role once it's actually been run, not by this generator).
// DATABASE_URL is still required alongside these — prisma.config.ts (createPrismaConfig()) reads
// it directly for Prisma CLI operations (generate/migrate), which need a static connection
// regardless of Vault. It's the same static superuser already scaffolded for <name>-db, and also
// the value to pass into `new PgAdapter(process.env.DATABASE_URL!)` for the manual "switch to
// root for testing" override documented in packages/server/CLAUDE.md's Database section.
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

// Appends the Vault-backed database env block to .env.sample (creating it if somehow missing)
// and, only if it already exists, to .env too — .env is gitignored and may not exist in a fresh
// checkout.
function appendDatabaseEnvBlock(absPath: string, block: string, createIfMissing: boolean): string | null {
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
	return `${collapseTrailingNewlines(raw)}networks:\n  adminer:\n`;
}

// Injects the <name>-migrate/<name>-db services before the top-level `networks:` key if one
// exists, else appends them (plus a fresh `networks:` section) at the end of the file.
function injectDockerComposeServices(absComposePath: string, snippet: string, name: string): string {
	const raw = fs.readFileSync(absComposePath, "utf-8");
	if (raw.includes(`${name}-migrate:`)) {
		return `${relToRoot(absComposePath)} already has database services`;
	}

	const networksMatch = raw.match(/^networks:\s*$/m);
	const before = collapseTrailingNewlines(
		networksMatch?.index !== undefined ? raw.slice(0, networksMatch.index) : raw,
		2,
	);
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

	const before = collapseTrailingNewlines(raw.slice(0, markerIndex), 2);
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

// Appends `postgres:`/`vault:` blocks (image/credentials/storage for postgres-deployment.yaml,
// and the in-cluster Vault address/role for VaultPgAdapter.fromEnv()) to helm/values.yaml — both
// brand-new top-level keys, so (unlike image.migrate above) just append at the end of the file,
// same pattern as KafkaGenerator's addKafkaHelmValues. `postgres:`'s user/password doubles as
// Vault's own DB-admin credential (see services/vault/CLAUDE.md) — no separate identity.
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
		`# more than a local/demo deployment. Also doubles as Vault's own DB-admin credential (see\n` +
		`# services/vault/CLAUDE.md) — no separate Vault-only identity.\n` +
		`postgres:\n  image: postgres:15.3-alpine\n  user: myuser\n  password: mypassword\n` +
		`  database: ${name}\n  storageSize: 1Gi\n`;

	const vaultBlock =
		`\n# In-cluster Vault (services/vault/helm, shared "infra" namespace) — see\n` +
		`# services/vault/CLAUDE.md for the dynamic-credential provisioning this depends on.\n` +
		`vault:\n  addr: http://vault.infra.svc.cluster.local:8200\n  dbRole: ${name}-role\n` +
		`  # Filled in manually after running services/vault/ansible's provisioning role against\n` +
		`  # the in-cluster Vault — Vault-issued, not knowable at \`turbo gen\` time.\n` +
		`  roleId: ""\n  secretId: ""\n`;

	const separator = raw.endsWith("\n") ? "" : "\n";
	fs.writeFileSync(absPath, `${raw}${separator}${postgresBlock}${vaultBlock}`);
	return `${relToRoot(absPath)} (+image.migrate, +postgres, +vault)`;
}

// Appends DB_HOST/DB_PORT/DB_NAME (pointing at postgres-service.yaml's Service) and
// VAULT_ADDR/VAULT_DB_ROLE to helm/templates/configmap.yaml — VaultPgAdapter.fromEnv()'s
// non-sensitive config. VAULT_ROLE_ID/VAULT_SECRET_ID are Vault-issued secrets and go into
// vault-secret.yaml instead (see addVaultHelmSecret), not this ConfigMap.
function addDatabaseConfigmapEnv(location: string): string {
	const absPath = path.join(process.cwd(), location, "helm", "templates", "configmap.yaml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	const raw = fs.readFileSync(absPath, "utf-8");
	if (raw.includes("DB_HOST")) {
		return `${relToRoot(absPath)} already has DB_HOST`;
	}
	const lines =
		`  # postgres-service.yaml's Service name — see its own comment for why this is a\n` +
		`  # dedicated per-server Postgres instead of a shared in-cluster one.\n` +
		`  DB_HOST: "{{ include "server.fullname" . }}-postgres"\n` +
		`  DB_PORT: "5432"\n` +
		`  DB_NAME: {{ .Values.postgres.database | quote }}\n` +
		`  VAULT_ADDR: {{ .Values.vault.addr | quote }}\n` +
		`  VAULT_DB_ROLE: {{ .Values.vault.dbRole | quote }}\n`;
	const separator = raw.endsWith("\n") ? "" : "\n";
	fs.writeFileSync(absPath, `${raw}${separator}${lines}`);
	return `${relToRoot(absPath)} (+DB_HOST, +DB_PORT, +DB_NAME, +VAULT_ADDR, +VAULT_DB_ROLE)`;
}

// Copies the vault-secret.yaml template (VAULT_ROLE_ID/VAULT_SECRET_ID from values.yaml's
// vault.roleId/vault.secretId) into helm/templates/ verbatim — same "real Helm Go-template
// syntax, plain file copy" reasoning as copyPostgresHelmTemplates.
function copyVaultHelmSecret(location: string): string {
	const destPath = path.join(process.cwd(), location, "helm", "templates", "vault-secret.yaml");
	if (fs.existsSync(destPath)) {
		return `${relToRoot(destPath)} already exists`;
	}
	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	fs.copyFileSync(path.join(POSTGRES_HELM_TEMPLATES_DIR, "vault-secret.yaml"), destPath);
	return relToRoot(destPath);
}

// Adds a `secretRef` entry to deployment.yaml's `envFrom` list (alongside the existing
// `configMapRef`) so the app container picks up VAULT_ROLE_ID/VAULT_SECRET_ID from
// vault-secret.yaml at runtime.
function injectVaultSecretEnvFrom(location: string): string {
	const absPath = path.join(process.cwd(), location, "helm", "templates", "deployment.yaml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	const raw = fs.readFileSync(absPath, "utf-8");
	if (raw.includes("-vault-secret")) {
		return `${relToRoot(absPath)} already references a vault secret`;
	}
	// Non-regex equivalent of /^(\s*)- configMapRef:\n\s*name: .*-config\n/m — Sonar's regex
	// super-linear-backtracking check (typescript:S8786) flagged the combination of two `\s*`
	// quantifiers either side of literal text; plain substring scanning sidesteps it entirely.
	const marker = "- configMapRef:\n";
	const markerIndex = raw.indexOf(marker);
	const lineStart = markerIndex === -1 ? -1 : raw.lastIndexOf("\n", markerIndex) + 1;
	const nameLineStart = markerIndex === -1 ? -1 : markerIndex + marker.length;
	const nameLineEnd = nameLineStart === -1 ? -1 : raw.indexOf("\n", nameLineStart);
	const nameLine = nameLineEnd === -1 ? "" : raw.slice(nameLineStart, nameLineEnd).trim();
	const isConfigMapNameLine = nameLine.startsWith("name: ") && nameLine.endsWith("-config");
	if (markerIndex === -1 || nameLineEnd === -1 || !isConfigMapNameLine) {
		return `${relToRoot(absPath)} has no configMapRef entry to anchor on, skipped`;
	}
	const indent = raw.slice(lineStart, markerIndex);
	const insertAt = nameLineEnd + 1;
	const secretRefBlock = `${indent}- secretRef:\n${indent}    name: {{ include "server.fullname" . }}-vault-secret\n`;
	const next = `${raw.slice(0, insertAt)}${secretRefBlock}${raw.slice(insertAt)}`;
	fs.writeFileSync(absPath, next);
	return `${relToRoot(absPath)} (+vault secretRef)`;
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
			const block = buildDatabaseEnvBlock(name, port);
			const results = [
				appendDatabaseEnvBlock(path.join(process.cwd(), location, ".env.sample"), block, true),
				appendDatabaseEnvBlock(path.join(process.cwd(), location, ".env"), block, false),
			].filter((result): result is string => result !== null);
			return results.length > 0 ? results.join("; ") : "no .env files updated";
		});

		// Ansible vars file for services/vault/ansible's provisioning role — must run before
		// injectDatabaseDockerCompose, since both call findAvailableDbPort and rely on
		// docker-compose.yml not having the port written yet for the two calls to agree.
		plop.setActionType("addVaultAnsibleVars", (answers, _config, plopApi) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const port = findAvailableDbPort(process.cwd());
			const destPath = path.join(process.cwd(), location, "ansible", "vars.yml");

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
				// `cd ../..` first (same convention as every "k8s:build" script — see
				// servers/test1/package.json) since `docker compose run` must run from wherever
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
				".database(PrismaClient, () => VaultPgAdapter.fromEnv())",
			);
		});

		plop.setActionType("wireDatabaseDockerCompose", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return wireComposeService(location, name, {
				// "vault" lets this container reach the vault service by hostname — see
				// services/vault/docker-compose.yml's own network declaration.
				networks: ["adminer", "vault"],
				environment: {
					DB_HOST: `${name}-db`,
					DB_PORT: "5432",
					DB_NAME: name,
					VAULT_ADDR: "http://vault:8200",
					VAULT_DB_ROLE: `${name}-role`,
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

		plop.setActionType("addVaultHelmSecret", (answers) => {
			const { location } = answers as { location: string };
			return [copyVaultHelmSecret(location), injectVaultSecretEnvFrom(location)].join("; ");
		});

		plop.setActionType("addDatabaseMigrateImageBuild", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			return addMigrateImageBuildStep(path.join(process.cwd(), location, "package.json"), location, name);
		});

		plop.setGenerator("database", {
			description:
				"Add Prisma/Postgres support to an existing server: package.json deps, prisma.config.ts, schema.prisma, .env(.sample), docker-compose.yml + Dockerfile migrate stage, wires .database(PrismaClient, VaultPgAdapter.fromEnv()) into app.ts (Vault-issued, short-lived Postgres credentials by default — see packages/server/CLAUDE.md's Database section for the manual root-credential testing override), an Ansible vars file + vault:provision script for services/vault/ansible's provisioning role, and adds a self-contained in-cluster Postgres (Deployment/PVC/Service + migration Job) plus a Vault AppRole credentials Secret to the server's helm chart",
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
				{ type: "addVaultAnsibleVars" },
				{ type: "injectDatabaseDockerCompose" },
				{ type: "wireDatabaseDockerCompose" },
				{ type: "injectDatabaseDockerfile" },
				{ type: "injectDatabaseIntoServerApp" },
				{ type: "addDatabaseHelmTemplates" },
				{ type: "addDatabaseHelmConfig" },
				{ type: "addVaultHelmSecret" },
				{ type: "addDatabaseMigrateImageBuild" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new DatabaseGenerator(plop, serverWorkspaces);
	}
}
