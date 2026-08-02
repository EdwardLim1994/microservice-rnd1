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
const INFRA_TEMPLATES_DIR = path.join(TEMPLATES_DIR, "infra");
const MONITORING_CONFIGMAP_PATH = path.join(
	process.cwd(),
	"services",
	"monitoring",
	"helm",
	"templates",
	"grafana-configmap.yaml",
);

/** kebab-case -> camelCase, for Helm template variable names (e.g. "server2-grpc" -> "server2GrpcDbPassword"). */
function camelCase(name: string): string {
	return name
		.split(/[-_]/)
		.map((part, i) =>
			i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
		)
		.join("");
}

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
 * Static superuser creds — same one scaffolded for <name>-infra's own container (see
 * infra/db.yaml.hbs) — passed straight into `new PgAdapter(databaseUrl)`. No Vault indirection;
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
 * e.g. demo1 has "5101:5432", so a second DB-enabled server gets 5102, not another 5101. This
 * port only matters for host-side `prisma` CLI access — kept as a stable-per-server local dev
 * convention even though the Postgres itself now lives in the separate <name>-infra chart.
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
 * Scaffolds the sibling `<name>-infra` chart (Chart.yaml, values.yaml, templates/db.yaml,
 * templates/db-provision-job.yaml, files/db-provision-*.sh) next to `<name>`'s own app chart —
 * Postgres (and any future Redis/etc.) for every server lives in the shared "server-infra"
 * namespace, Terraform-applied (see apps/terraform/main.tf, which auto-discovers any
 * apps/servers/*-infra/helm/Chart.yaml — no registration needed here beyond creating the files).
 */
function scaffoldInfraChart(
	root: string,
	location: string,
	name: string,
	plopApi: { renderString: (template: string, data: unknown) => string },
): string {
	const infraDir = path.join(
		root,
		path.dirname(location),
		`${name}-infra`,
		"helm",
	);
	if (fs.existsSync(infraDir)) {
		return `${path.relative(root, infraDir)} already exists`;
	}

	const render = (templateName: string) =>
		plopApi.renderString(
			fs.readFileSync(path.join(INFRA_TEMPLATES_DIR, templateName), "utf-8"),
			{ name },
		);

	fs.mkdirSync(path.join(infraDir, "templates"), { recursive: true });
	fs.mkdirSync(path.join(infraDir, "files"), { recursive: true });
	fs.writeFileSync(path.join(infraDir, "Chart.yaml"), render("Chart.yaml.hbs"));
	fs.writeFileSync(
		path.join(infraDir, "values.yaml"),
		render("values.yaml.hbs"),
	);
	fs.writeFileSync(
		path.join(infraDir, "templates", "db.yaml"),
		render("db.yaml.hbs"),
	);
	fs.writeFileSync(
		path.join(infraDir, "templates", "db-provision-job.yaml"),
		render("db-provision-job.yaml.hbs"),
	);
	fs.writeFileSync(
		path.join(infraDir, "files", "db-provision-init.sh"),
		render("db-provision-init.sh.hbs"),
	);
	fs.writeFileSync(
		path.join(infraDir, "files", "db-provision-main.sh"),
		render("db-provision-main.sh.hbs"),
	);
	return `${path.relative(root, infraDir)} (+${name}-infra chart)`;
}

/**
 * Appends `infraNamespace: server-infra` / `dbPassword: ""` to the app chart's own, already
 * existing helm/values.yaml (created by the base "server" template) — a splice-append, not a
 * fresh `add` action, since that file already exists by the time this generator runs and a
 * `skipIfExists` "add" would silently skip writing these keys at all (confirmed the hard way:
 * this exact gap left a freshly-scaffolded server missing `dbProvision` entirely once already).
 * Idempotent: skips if "infraNamespace:" is already present.
 */
function appendInfraNamespaceToValues(absValuesPath: string): string {
	const existing = fs.existsSync(absValuesPath)
		? fs.readFileSync(absValuesPath, "utf-8")
		: "";
	if (existing.includes("infraNamespace:")) {
		return `${relToRoot(absValuesPath)} already has infraNamespace`;
	}
	const block =
		`\n# Where <name>-infra's Postgres actually lives — every hostname this chart's own\n` +
		`# templates reference for it has to be the fully-qualified cross-namespace form\n` +
		`# (<name>-db.{{ .Values.infraNamespace }}.svc.cluster.local), not the bare in-namespace\n` +
		`# name that would work if everything shared one chart/namespace.\n` +
		`infraNamespace: server-infra\n\n` +
		`# Bootstrap-only password override, empty by default — env.yaml's <name>-secret\n` +
		`# (DATABASE_URL) falls back to a \`lookup\` of <name>-infra's real password Secret\n` +
		`# (cross-namespace — Helm's \`lookup\` takes an explicit namespace argument, not just the\n` +
		`# release's own). Tilt's own helm() has no live cluster access at all, so that \`lookup\`\n` +
		`# always returns nothing there — this chart's own Tiltfile instead reads the real,\n` +
		`# Terraform-generated password straight from the (already Terraform-applied) cluster via\n` +
		`# \`kubectl get secret\` and passes it as this override.\n` +
		`dbPassword: ""\n`;
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absValuesPath, `${existing}${separator}${block}`);
	return `${relToRoot(absValuesPath)} (+infraNamespace, +dbPassword)`;
}

/**
 * Adds a `sync()` for this server's own generated/ dir (Prisma client output — see
 * schema.prisma.hbs's `output` path) to the main docker_build's `live_update` list, right before
 * `restart_container()` — without it, the "development" stage's live_update never picks up a
 * freshly regenerated Prisma client. Idempotent: skips if a "generated" sync is already there.
 */
function injectGeneratedSync(absTiltfilePath: string, name: string): string {
	const raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (raw.includes('/generated"')) {
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
 * Adds `set=["dbPassword=" + db_password]` to the existing `k8s_yaml(helm("./helm", ...))` call
 * (finds the whole `k8s_yaml(helm(` marker, not just `helm(` — a bare `helm(` also matches
 * inside this same Tiltfile's own prose comments describing Tilt's helm(), which don't have a
 * matching close paren where expected — and splices right before the real call's own closing
 * paren, same bracket-matching approach as helpers.ts's injectDriverEntry).
 * Idempotent: skips if a `set=` argument is already present on that call.
 */
function injectHelmDbPasswordSet(absTiltfilePath: string): string {
	const raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (raw.includes('set=["dbPassword=')) {
		return `${relToRoot(absTiltfilePath)} already sets dbPassword`;
	}

	const marker = "k8s_yaml(helm(";
	const markerIndex = raw.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(`Could not find "${marker}" in ${absTiltfilePath}`);
	}
	const openParenIndex = markerIndex + marker.length - 1;
	const closeParenIndex = findMatchingBracket(raw, openParenIndex, "(", ")");

	const before = raw.slice(0, closeParenIndex);
	const trimmedBefore = before.trimEnd();
	const needsComma =
		!trimmedBefore.endsWith(",") && !trimmedBefore.endsWith("(");
	const insertion = `${needsComma ? "," : ""}\n    set=["dbPassword=" + db_password],\n`;

	const next = `${before}${insertion}${raw.slice(closeParenIndex)}`;
	fs.writeFileSync(absTiltfilePath, next);
	return `${relToRoot(absTiltfilePath)} (+dbPassword set)`;
}

/**
 * Adds the `db_password = str(local("kubectl get secret <name>-db-secret -n server-infra ..."))`
 * lookup line right before the `k8s_yaml(helm(` call, plus the migrate image build + its
 * k8s_resource — <name>-infra itself (Postgres/Vault-provisioning) is Terraform-applied, not
 * Tilt-managed, so unlike the old colocated setup there's no "<name>-db"/"<name>-db-provision"
 * k8s_resource() to register here anymore, just the migrate Job that still lives in this app
 * chart.
 */
function appendDatabaseTiltfile(absTiltfilePath: string, name: string): string {
	injectGeneratedSync(absTiltfilePath, name);
	const setResult = injectHelmDbPasswordSet(absTiltfilePath);

	let raw = fs.readFileSync(absTiltfilePath, "utf-8");
	if (!raw.includes("db_password = ")) {
		const marker = "k8s_yaml(helm(";
		const markerIndex = raw.indexOf(marker);
		if (markerIndex === -1) {
			throw new Error(`Could not find "${marker}" in ${absTiltfilePath}`);
		}
		const lineStart = raw.lastIndexOf("\n", markerIndex) + 1;
		const lookup =
			`# postgres/Vault-provisioning moved to ${name}-infra (Terraform-applied once, see\n` +
			`# apps/terraform) — this chart is just the app Deployment/Service/migrate Job now, and\n` +
			`# needs ${name}-infra to already exist (run \`terraform apply\` there first).\n` +
			`#\n` +
			`# dbPassword: this chart's own env.yaml builds DATABASE_URL by \`lookup\`-ing\n` +
			`# ${name}-infra's real password Secret — but Tilt's own helm() has no live cluster access\n` +
			`# at all, so that \`lookup\` always returns nothing here. Unlike a Tilt-only dev password,\n` +
			`# ${name}-infra's is a Terraform-generated random value, not a Tilt-controlled override.\n` +
			`# Read it straight from the (already Terraform-applied) cluster instead.\n` +
			`db_password = str(local(\n` +
			`    "kubectl get secret ${name}-db-secret -n server-infra -o jsonpath='{.data.password}' | base64 -d",\n` +
			`    quiet=True,\n` +
			`)).strip()\n\n`;
		raw = `${raw.slice(0, lineStart)}${lookup}${raw.slice(lineStart)}`;
		fs.writeFileSync(absTiltfilePath, raw);
	}

	if (raw.includes(`${name}-migrate`)) {
		return `${setResult}; ${relToRoot(absTiltfilePath)} already has migrate resources`;
	}
	raw = fs.readFileSync(absTiltfilePath, "utf-8");
	const snippet =
		`\ndocker_build("${name}-migrate", "../../..", dockerfile="./Dockerfile", target="migrate")\n\n` +
		`k8s_resource(\n    "${name}-migrate",\n    labels=["servers"],\n)\n`;
	fs.writeFileSync(
		absTiltfilePath,
		`${collapseTrailingNewlines(raw)}\n${snippet}`,
	);
	return `${setResult}; ${relToRoot(absTiltfilePath)} (+${name}-migrate)`;
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

/**
 * Writes <location>/grafana-datasources.yaml — the per-server source-of-truth mirror (same
 * convention as apps/servers/server1-grpc/server2-grpc's own copies), documenting the datasource
 * that wireGrafanaConfigmap below actually wires into Grafana (inlined there, not loaded via
 * this file directly — see that function's own comment for why).
 */
function scaffoldGrafanaDatasourceFile(
	root: string,
	location: string,
	name: string,
): string {
	const destPath = path.join(root, location, "grafana-datasources.yaml");
	if (fs.existsSync(destPath)) {
		return `${path.relative(root, destPath)} already exists`;
	}
	const content =
		"apiVersion: 1\n\n" +
		`# Direct query access (SQL Explore), for ad-hoc queries against ${name}'s own data — no\n` +
		"# postgres-exporter sidecar wired for this chart, so there's no Prometheus metrics path.\n" +
		"#\n" +
		"# ponytail: password below is a stale placeholder — see services/monitoring/helm/templates/\n" +
		`# grafana-configmap.yaml's inlined copy of this file, which substitutes the real\n` +
		`# ${name}-db-secret password via \`lookup\` at render time. This file is just the\n` +
		"# source-of-truth mirror.\n" +
		"datasources:\n" +
		`  - name: ${name} Postgres\n` +
		`    uid: ${name}-postgres\n` +
		'    # Canonical plugin id, not the deprecated "postgres" alias — the alias leaves the\n' +
		"    # resource client (table/schema dropdown in the query builder) unwired.\n" +
		"    type: grafana-postgresql-datasource\n" +
		"    access: proxy\n" +
		`    url: ${name}-db.server-infra.svc.cluster.local:5432\n` +
		`    database: ${name}\n` +
		"    user: myuser\n" +
		"    editable: false\n" +
		"    jsonData:\n" +
		"      sslmode: disable\n" +
		"      postgresVersion: 1500\n" +
		"    secureJsonData:\n" +
		`      password: ${name}-tilt-local-dev-db-password\n`;
	fs.writeFileSync(destPath, content);
	return `${path.relative(root, destPath)} (+${name} Postgres datasource)`;
}

/**
 * Wires <name>'s Postgres into services/monitoring's own Grafana provisioning ConfigMap: a
 * `$<name>DbPassword` `lookup`-of-the-real-Secret block (same trick as the existing
 * server1/server2 blocks above it — see this file's own header comment) plus an inlined
 * datasource key. Inlined, not loaded via `.Files.Get` of the sibling grafana-datasources.yaml
 * file above — `.Files.Get` bypasses Helm's own Go-templating entirely, which is exactly why a
 * datasource wired that way ships with a permanently-stale placeholder password instead of the
 * `lookup`-derived real one. Idempotent: skips if this server's variable is already present.
 */
function wireGrafanaConfigmap(root: string, name: string): string {
	if (!fs.existsSync(MONITORING_CONFIGMAP_PATH)) {
		return `${path.relative(root, MONITORING_CONFIGMAP_PATH)} not found, skipped`;
	}
	const varName = `${camelCase(name)}DbPassword`;
	const secretVarName = `${camelCase(name)}DbSecret`;

	let raw = fs.readFileSync(MONITORING_CONFIGMAP_PATH, "utf-8");
	if (raw.includes(`$${varName}`)) {
		return `${path.relative(root, MONITORING_CONFIGMAP_PATH)} already wires ${name}`;
	}

	const apiVersionMarker = "\napiVersion: v1\n";
	const apiVersionIndex = raw.indexOf(apiVersionMarker);
	if (apiVersionIndex === -1) {
		throw new Error(
			`Could not find "apiVersion: v1" in ${MONITORING_CONFIGMAP_PATH}`,
		);
	}
	const lookupBlock =
		`{{- $${secretVarName} := lookup "v1" "Secret" "server-infra" "${name}-db-secret" }}\n` +
		`{{- $${varName} := "${name}-tilt-local-dev-db-password" }}\n` +
		`{{- if $${secretVarName} }}\n` +
		`{{- $${varName} = index $${secretVarName}.data "password" | b64dec }}\n` +
		"{{- end }}\n";
	const lookupInsertAt = apiVersionIndex + 1;
	raw = `${raw.slice(0, lookupInsertAt)}${lookupBlock}${raw.slice(lookupInsertAt)}`;

	const dashboardsMarker = "  dashboards.yaml: |";
	const dashboardsIndex = raw.indexOf(dashboardsMarker);
	if (dashboardsIndex === -1) {
		throw new Error(
			`Could not find "${dashboardsMarker}" in ${MONITORING_CONFIGMAP_PATH}`,
		);
	}
	const datasourceBlock =
		`  # Real copy of ${path.posix.join("apps/servers", name)}/grafana-datasources.yaml, inlined\n` +
		"  # for the same reason as the other per-server datasource keys above (Go-templating the\n" +
		"  # password substitution in).\n" +
		`  ${name}-datasources.yaml: |\n` +
		"    apiVersion: 1\n" +
		"\n" +
		"    datasources:\n" +
		`      - name: ${name} Postgres\n` +
		`        uid: ${name}-postgres\n` +
		"        type: grafana-postgresql-datasource\n" +
		"        access: proxy\n" +
		`        url: ${name}-db.server-infra.svc.cluster.local:5432\n` +
		`        database: ${name}\n` +
		"        user: myuser\n" +
		"        editable: false\n" +
		"        jsonData:\n" +
		"          sslmode: disable\n" +
		"          postgresVersion: 1500\n" +
		"        secureJsonData:\n" +
		`          password: {{ $${varName} }}\n`;
	raw = `${raw.slice(0, dashboardsIndex)}${datasourceBlock}${raw.slice(dashboardsIndex)}`;

	fs.writeFileSync(MONITORING_CONFIGMAP_PATH, raw);
	return `${path.relative(root, MONITORING_CONFIGMAP_PATH)} (+${name} datasource)`;
}

/**
 * Adds a subPath volumeMount for <name>'s datasource key to grafana-statefulset.yaml — a
 * ConfigMap key alone is not enough for Grafana to see it: this StatefulSet mounts the
 * "provisioning" ConfigMap one file at a time (subPath per file, not the whole ConfigMap as a
 * directory), so every new datasource key needs its own explicit volumeMount entry here too, or
 * it silently never reaches the pod at all. Idempotent: skips if this server's mount already
 * exists.
 */
function wireGrafanaStatefulsetMount(root: string, name: string): string {
	const statefulsetPath = path.join(
		root,
		"services",
		"monitoring",
		"helm",
		"templates",
		"grafana-statefulset.yaml",
	);
	if (!fs.existsSync(statefulsetPath)) {
		return `${path.relative(root, statefulsetPath)} not found, skipped`;
	}
	const raw = fs.readFileSync(statefulsetPath, "utf-8");
	if (raw.includes(`subPath: ${name}-datasources.yaml`)) {
		return `${path.relative(root, statefulsetPath)} already mounts ${name}`;
	}

	const marker = /^(\s+)- name: provisioning\n\s+mountPath: \/etc\/grafana\/provisioning\/dashboards\/dashboards\.yaml\n/m;
	const match = marker.exec(raw);
	if (!match) {
		throw new Error(`Could not find the dashboards.yaml volumeMount in ${statefulsetPath}`);
	}
	const indent = match[1];
	const entry =
		`${indent}- name: provisioning\n` +
		`${indent}  mountPath: /etc/grafana/provisioning/datasources/${name}.yaml\n` +
		`${indent}  subPath: ${name}-datasources.yaml\n`;
	const insertAt = match.index;
	const next = `${raw.slice(0, insertAt)}${entry}${raw.slice(insertAt)}`;
	fs.writeFileSync(statefulsetPath, next);
	return `${path.relative(root, statefulsetPath)} (+${name} volumeMount)`;
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

		// Scaffolds the sibling <name>-infra chart (Postgres + Vault provisioning), and appends
		// this app chart's own infraNamespace/dbPassword to its already-existing values.yaml.
		plop.setActionType(
			"scaffoldDatabaseInfraChart",
			(answers, _config, plopApi) => {
				const { location } = answers as { location: string };
				const name = path.basename(location);
				const infraResult = scaffoldInfraChart(
					process.cwd(),
					location,
					name,
					plopApi,
				);
				const valuesResult = appendInfraNamespaceToValues(
					path.join(process.cwd(), location, "helm", "values.yaml"),
				);
				return `${infraResult}; ${valuesResult}`;
			},
		);

		plop.setActionType("injectDatabaseEnvYaml", (answers, _config, plopApi) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const destPath = path.join(
				process.cwd(),
				location,
				"helm",
				"templates",
				"env.yaml",
			);
			if (fs.existsSync(destPath)) {
				return `${relToRoot(destPath)} already exists`;
			}
			const template = fs.readFileSync(
				path.join(TEMPLATES_DIR, "env.yaml.hbs"),
				"utf-8",
			);
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.writeFileSync(destPath, plopApi.renderString(template, { name }));
			const tiltResult = appendDatabaseTiltfile(
				path.join(process.cwd(), location, "Tiltfile"),
				name,
			);
			return `${relToRoot(destPath)}; ${tiltResult}`;
		});

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

		// Wires this server's Postgres into Grafana by default — same datasource pattern already
		// hand-maintained for server1-grpc/server2-grpc, now automatic for every new database.
		plop.setActionType("wireGrafanaDatasource", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const fileResult = scaffoldGrafanaDatasourceFile(
				process.cwd(),
				location,
				name,
			);
			const configmapResult = wireGrafanaConfigmap(process.cwd(), name);
			const mountResult = wireGrafanaStatefulsetMount(process.cwd(), name);
			return `${fileResult}; ${configmapResult}; ${mountResult}`;
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
			// Vault-minted credentials (see infra/db-provision-job.yaml.hbs), rotated in place by
			// that Job/CronJob without this Deployment's envFrom ever changing.
			const secretResult = wireHelmDeploymentConfigMap(
				deploymentPath,
				`${name}-secret`,
				"secretRef",
			);
			// Fully-qualified — <name>-db now lives in <name>-infra, a different namespace than
			// this Deployment's own (see values.yaml's infraNamespace).
			const waitResult = wireHelmInitContainerWait(
				deploymentPath,
				`wait-for-${name}-db`,
				"postgres:15.3-alpine",
				`until pg_isready -h ${name}-db.{{ .Values.infraNamespace }}.svc.cluster.local -p 5432 -U myuser; do sleep 2; done`,
			);
			return `${configMapResult}; ${secretResult}; ${waitResult}`;
		});

		plop.setGenerator("database", {
			description:
				'Add Prisma/Postgres support to an existing server: package.json deps, prisma.config.ts, schema.prisma, .env(.sample), a sibling <name>-infra chart (Postgres Deployment/Service/Secret + Vault provisioning, Terraform-applied into the shared "server-infra" namespace) + this chart\'s own env.yaml (ConfigMap/Secret/migrate Job, cross-namespace `lookup` into <name>-infra) + Tiltfile wiring + Dockerfile migrate stage, wires .database(PrismaClient, new PgAdapter(databaseUrl)) into app.ts (app.ts itself only ever reads DATABASE_URL, so no app-side Vault client code is needed — the old VaultPgAdapter approach; see services/vault/CLAUDE.md for the provisioning story), and wires this Postgres into Grafana as a datasource by default (grafana-datasources.yaml + an inlined, `lookup`-substituted copy in services/monitoring/helm/templates/grafana-configmap.yaml)',
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
				{ type: "scaffoldDatabaseInfraChart" },
				{ type: "injectDatabaseEnvYaml" },
				{ type: "wireDatabaseHelmDeployment" },
				{ type: "injectDatabaseDockerfile" },
				{ type: "injectDatabaseIntoServerApp" },
				{ type: "wireGrafanaDatasource" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new DatabaseGenerator(plop, serverWorkspaces);
	}
}
