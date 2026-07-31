import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";

function isServerWorkspace(absDir: string): boolean {
	const pkgPath = path.join(absDir, "package.json");
	if (!fs.existsSync(pkgPath)) return false;
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
	const deps = { ...pkg.dependencies, ...pkg.devDependencies };
	return Boolean(deps.server);
}

/**
 * Only apps/servers/<name> that actually depend on the `server` framework package.
 */
export function findServerWorkspaces(root: string): string[] {
	const serversDir = path.join(root, "apps", "servers");
	if (!fs.existsSync(serversDir)) return [];
	return fs
		.readdirSync(serversDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join("apps", "servers", entry.name))
		.filter((rel) => isServerWorkspace(path.join(root, rel)));
}

/**
 * Only servers that have a Prisma schema, i.e. actually have a PrismaClient for
 * BaseRepository<PrismaClient> to be constructed against.
 */
export function findPrismaServerWorkspaces(root: string): string[] {
	return findServerWorkspaces(root).filter((rel) =>
		fs.existsSync(
			path.join(root, rel, "src", "schemas", "prisma", "schema.prisma"),
		),
	);
}

/**
 * The inverse: server workspaces that don't have a database yet, i.e. eligible
 * targets for the "database" extension generator.
 */
export function findServerWorkspacesWithoutPrisma(root: string): string[] {
	const withPrisma = new Set(findPrismaServerWorkspaces(root));
	return findServerWorkspaces(root).filter((rel) => !withPrisma.has(rel));
}

/**
 * Whether a server workspace already has the given driver wired up in its app.ts (matched by
 * the driver's export name, e.g. "GrpcDriver"/"ApolloDriver"/"KafkaDriver") — the eligibility
 * check behind the unified "extension" generator's per-server driver choices.
 */
export function serverHasDriver(
	root: string,
	location: string,
	driverName: string,
): boolean {
	const appPath = path.join(root, location, "src", "app.ts");
	if (!fs.existsSync(appPath)) return false;
	return fs.readFileSync(appPath, "utf-8").includes(driverName);
}

/**
 * Shared "list" prompt choices for a location prompt, with a disabled placeholder
 * when no eligible workspace was found.
 */
export function workspaceChoices(
	workspaces: string[],
	emptyMessage: string,
): PlopTypes.PromptQuestion["choices"] {
	return workspaces.length > 0
		? workspaces
		: [{ name: emptyMessage, value: "", disabled: true }];
}

/**
 * Detects a file's own indentation style (servers are inconsistent: demo1 uses
 * 2-space, demo2 uses tabs), so a JSON/TS rewrite can preserve it instead of clobbering it.
 */
export function detectIndent(raw: string): string {
	const match = /\n([ \t]+)\S/.exec(raw);
	return match ? match[1] : "\t";
}

/**
 * Scans forward from `openIndex` (which must point at `openChar`) counting nested
 * open/close chars, returning the index of the matching close char.
 */
export function findMatchingBracket(
	text: string,
	openIndex: number,
	openChar: string,
	closeChar: string,
): number {
	let depth = 0;
	for (let i = openIndex; i < text.length; i++) {
		if (text[i] === openChar) depth++;
		else if (text[i] === closeChar) {
			depth--;
			if (depth === 0) return i;
		}
	}
	throw new Error(
		`No matching "${closeChar}" found starting at index ${openIndex}`,
	);
}

export function addNamedImport(
	raw: string,
	source: string,
	importName: string,
): string {
	const importRegex = new RegExp(
		String.raw`import\s*\{([^}]*)\}\s*from\s*["']${source}["'];?`,
	);
	const match = importRegex.exec(raw);
	if (!match) {
		throw new Error(`Could not find an import from "${source}"`);
	}
	const names = match[1]
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (names.includes(importName)) return raw;
	names.push(importName);
	names.sort((a, b) => a.localeCompare(b));
	return raw.replace(
		importRegex,
		`import { ${names.join(", ")} } from "${source}";`,
	);
}

/**
 * Like addNamedImport, but tolerates `source` not being imported yet — merges into an existing
 * `import { ... } from "<source>"` if one exists, else adds a fresh import statement right after
 * the last top-level import. Useful when the caller can't guarantee the target file already
 * imports from that source (e.g. injecting a new page's import into a router file that may not
 * yet import anything from that page's module).
 */
export function addOrMergeNamedImport(
	raw: string,
	source: string,
	importName: string,
): string {
	const importRegex = new RegExp(
		String.raw`import\s*\{([^}]*)\}\s*from\s*["']${source}["'];?`,
	);
	if (importRegex.test(raw)) {
		return addNamedImport(raw, source, importName);
	}
	const importLine = `import { ${importName} } from "${source}";`;
	const importMatches = [...raw.matchAll(/^import\s[^;]*;$/gm)];
	const lastImport = importMatches.at(-1);
	if (!lastImport) {
		return `${importLine}\n${raw}`;
	}
	const insertAt = (lastImport.index ?? 0) + lastImport[0].length;
	return `${raw.slice(0, insertAt)}\n${importLine}${raw.slice(insertAt)}`;
}

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

export interface PackageJson {
	scripts: Record<string, string>;
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	[key: string]: unknown;
}

/**
 * Merges devDependencies/dependencies into a package.json, preserving that file's own
 * indentation style (servers are inconsistent: demo1 uses 2-space, demo2 uses tabs). Doesn't
 * write the file — call writePackageJson once all merges (deps + gen script) are applied.
 */
export function mergePackageJsonDeps(
	absPackageJsonPath: string,
	devDependencies: Record<string, string>,
	dependencies: Record<string, string>,
): { pkg: PackageJson; indent: string } {
	const raw = fs.readFileSync(absPackageJsonPath, "utf-8");
	const indent = detectIndent(raw);
	const pkg = JSON.parse(raw);

	pkg.devDependencies ??= {};
	pkg.dependencies ??= {};
	pkg.scripts ??= {};

	Object.assign(pkg.devDependencies, devDependencies);
	Object.assign(pkg.dependencies, dependencies);

	return { pkg, indent };
}

/**
 * Sets scripts.gen to `packages/script`'s shared generate-api.ts entrypoint (proto and/or
 * GraphQL codegen, driven by APIGenerator, which infers the project name from cwd) unless
 * something else is already there — "gen" is a single named command, not a lifecycle hook, so
 * if it's already set to something else we leave it alone and report it rather than silently
 * overwriting it. One shared script for every server means no per-server wrapper file to
 * generate at all.
 */
export function ensureGenScript(pkg: PackageJson, absPackageJsonPath: string): string {
	const scriptBinPath = path.join(process.cwd(), "packages", "script", "src", "bin", "generate-api.ts");
	const relScriptBinPath = path.relative(path.dirname(absPackageJsonPath), scriptBinPath);
	const genScript = `bun ${relScriptBinPath}`;
	const existingGen = pkg.scripts.gen;
	if (!existingGen) {
		pkg.scripts.gen = genScript;
		return "";
	}
	if (existingGen !== genScript) {
		return " (scripts.gen already set to something else, left unchanged)";
	}
	return "";
}

export function writePackageJson(
	absPackageJsonPath: string,
	pkg: PackageJson,
	indent: string,
): void {
	fs.writeFileSync(
		absPackageJsonPath,
		`${JSON.stringify(pkg, null, indent)}\n`,
	);
}

/**
 * Rewrites `ServerApp.init(...)` to add a driver entry — handling both the bare
 * single-driver form (apps/servers/templates/server's own scaffold, `ServerApp.init(CronDriver)`)
 * and the array-of-entries form (apps/servers/demo1's shape). Converting from the bare form also
 * collapses its now-redundant `.run(() => \`...\`)` callback to a bare `.run()`, since once a
 * driver has its own onReady, a single global "server is running" callback doesn't fit.
 * `buildEntry(itemIndent)` renders the `{ driver: ..., ... }` object literal text (no trailing
 * comma). `extraImports` adds further named imports from "server" alongside the driver itself
 * (e.g. KafkaDriver's entry also references SchemaRegistryKafkaSerializer).
 */
export function injectDriverEntry(
	absAppPath: string,
	driverName: string,
	buildEntry: (itemIndent: string) => string,
	extraImports: string[] = [],
): string {
	let raw = fs.readFileSync(absAppPath, "utf-8");
	if (raw.includes(driverName)) {
		return `${relToRoot(absAppPath)} already has ${driverName}`;
	}

	raw = addNamedImport(raw, "server", driverName);
	for (const importName of extraImports) {
		raw = addNamedImport(raw, "server", importName);
	}

	const initMarker = "ServerApp.init(";
	const initIndex = raw.indexOf(initMarker);
	if (initIndex === -1) {
		throw new Error(`Could not find "${initMarker}" in ${absAppPath}`);
	}
	const openParenIndex = initIndex + initMarker.length - 1;
	const closeParenIndex = findMatchingBracket(raw, openParenIndex, "(", ")");
	const argsText = raw.slice(openParenIndex + 1, closeParenIndex);
	const trimmedArgs = argsText.trim();

	const indentMatch = /\n(\t+| +)await ServerApp\.init/.exec(raw);
	const baseIndent = indentMatch ? indentMatch[1] : "\t";
	const itemIndent = `${baseIndent}\t`;

	const entry = buildEntry(itemIndent);

	if (trimmedArgs.startsWith("[")) {
		const openBracketIndex = openParenIndex + 1 + argsText.indexOf("[");
		const closeBracketIndex = findMatchingBracket(
			raw,
			openBracketIndex,
			"[",
			"]",
		);
		const inner = raw.slice(openBracketIndex + 1, closeBracketIndex).trimEnd();
		const separator =
			inner.trim() === "" || inner.trim().endsWith(",") ? "" : ",";
		const newInner = `${inner}${separator}\n${itemIndent}${entry},\n${baseIndent}`;
		raw = `${raw.slice(0, openBracketIndex)}[${newInner}]${raw.slice(closeBracketIndex + 1)}`;
	} else {
		const newArgsText = `[\n${itemIndent}${trimmedArgs},\n${itemIndent}${entry},\n${baseIndent}]`;
		raw = `${raw.slice(0, openParenIndex + 1)}${newArgsText}${raw.slice(closeParenIndex)}`;
		raw = raw.replace(/\.run\(\s*\(\)\s*=>\s*`[^`]*`\s*\)/, ".run()");
	}

	fs.writeFileSync(absAppPath, raw);
	return `${relToRoot(absAppPath)} (+${driverName})`;
}

function appendBarrelExport(absBarrelPath: string, name: string): string {
	fs.mkdirSync(path.dirname(absBarrelPath), { recursive: true });
	const line = `export { default as ${name} } from "./${name}";`;
	const existing = fs.existsSync(absBarrelPath)
		? fs.readFileSync(absBarrelPath, "utf-8")
		: "";
	if (existing.includes(line)) {
		return `${absBarrelPath} already exports ${name}`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absBarrelPath, `${existing}${separator}${line}\n`);
	return `${absBarrelPath} (+${name})`;
}

/**
 * Registers the "appendBarrel" custom action, shared by usecase/repository/interceptor/router
 * generators: appends `export { default as <name> } from "./<name>";` to <location>/src/<folder>/index.ts,
 * creating the folder/barrel if it doesn't exist yet.
 */
export function registerAppendBarrelAction(plop: PlopTypes.NodePlopAPI): void {
	plop.setActionType("appendBarrel", (answers, config) => {
		const { location, name } = answers as { location: string; name: string };
		const { folder } = (config.data ?? {}) as { folder: string };
		const absBarrel = path.join(
			process.cwd(),
			location,
			"src",
			folder,
			"index.ts",
		);
		return appendBarrelExport(absBarrel, name);
	});
}

/**
 * "web" (Rsbuild) is matched by rsbuild.config.ts, "native" (Expo/React Native) by
 * metro.config.js — a "react-dom" dependency check isn't reliable since apps/mobile's
 * package.json happens to list one too.
 */
export function frontendPlatform(
	root: string,
	location: string,
): "web" | "native" | null {
	if (fs.existsSync(path.join(root, location, "rsbuild.config.ts")))
		return "web";
	if (fs.existsSync(path.join(root, location, "metro.config.js")))
		return "native";
	return null;
}

/**
 * React frontend workspaces (web or native) under apps/web/*, apps/mfe/* and apps/mobile/* —
 * see frontendPlatform for how each is told apart.
 */
export function findFrontendWorkspaces(root: string): string[] {
	return ["apps/web", "apps/mfe", "apps/mobile"].flatMap((dir) => {
		const base = path.join(root, dir);
		if (!fs.existsSync(base)) return [];
		return fs
			.readdirSync(base, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => path.join(dir, entry.name))
			.filter((rel) => frontendPlatform(root, rel) !== null);
	});
}

export const DEFAULT_FRONTEND_PORT = 3000;

/**
 * Scans every apps/web/* /rsbuild.config.ts and apps/mfe/* /rsbuild.config.ts for a dev server
 * port already in use (matched within its `server: { ... port: N ... }` block specifically, not
 * the `dev.assetPrefix` string which embeds the same port number in a different spot) and
 * returns the lowest one >= DEFAULT_FRONTEND_PORT not already taken — e.g. apps/web/portal has
 * 3000 and apps/mfe/frontend1 has 3001, so a third project gets 3002.
 */
export function findAvailableFrontendPort(root: string): number {
	const usedPorts = new Set<number>();

	for (const dir of ["apps/web", "apps/mfe"]) {
		const base = path.join(root, dir);
		if (!fs.existsSync(base)) continue;
		for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const configPath = path.join(base, entry.name, "rsbuild.config.ts");
			if (!fs.existsSync(configPath)) continue;
			const match = /server:\s*\{[^}]*port:\s*(\d+)/s.exec(
				fs.readFileSync(configPath, "utf-8"),
			);
			if (match) usedPorts.add(Number(match[1]));
		}
	}

	let port = DEFAULT_FRONTEND_PORT;
	while (usedPorts.has(port)) port++;
	return port;
}

const DEFAULT_MOBILE_PORT = 3011;

/**
 * Reads a single apps/mobile/* /package.json's "dev" script for a `--port N` already in use — the
 * per-workspace half of findAvailableMobilePort's scan, split out to keep that function's
 * cognitive complexity down. Harmless to call for every apps/mobile/* workspace, not just Expo
 * ones — an Rsbuild-based app's "dev" script ("rsbuild --open") never matches the `--port`
 * pattern, so it just returns null.
 */
function extractMobilePortFromPackageJson(pkgPath: string): number | null {
	if (!fs.existsSync(pkgPath)) return null;
	const devScript = JSON.parse(fs.readFileSync(pkgPath, "utf-8")).scripts
		?.dev as string | undefined;
	const match = devScript ? /--port\s+(\d+)/.exec(devScript) : null;
	return match ? Number(match[1]) : null;
}

/**
 * Scans every apps/mobile/* /package.json for a `--port N` already used in its "dev" script
 * (Expo's dev-server/tunnel port — apps/mobile/mobile's own is `expo start --host tunnel --port
 * 3011`) and returns the lowest one >= DEFAULT_MOBILE_PORT not already taken.
 */
export function findAvailableMobilePort(root: string): number {
	const usedPorts = new Set<number>();

	const appsDir = path.join(root, "apps", "mobile");
	if (fs.existsSync(appsDir)) {
		for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const port = extractMobilePortFromPackageJson(
				path.join(appsDir, entry.name, "package.json"),
			);
			if (port !== null) usedPorts.add(port);
		}
	}

	let port = DEFAULT_MOBILE_PORT;
	while (usedPorts.has(port)) port++;
	return port;
}

/**
 * Existing modules (each a directory) under <location>/src/modules — the eligible targets for
 * the page/viewmodel/component generators, which add into a module rather than create one.
 */
export function findFrontendModules(root: string, location: string): string[] {
	const modulesDir = path.join(root, location, "src", "modules");
	if (!fs.existsSync(modulesDir)) return [];
	return fs
		.readdirSync(modulesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

/**
 * Appends a raw export line to a barrel file (creating the folder/file if missing) — the
 * frontend module convention uses both named re-exports (pages: `export { X } from './X';`,
 * matching frontend1's src/modules/demo1/pages/index.ts) and wildcard re-exports (viewmodel/
 * types: `export * from './x';`), so this takes the fully-formed line rather than assuming one
 * style, unlike the backend's appendBarrelExport.
 */
export function appendBarrelLine(absBarrelPath: string, line: string): string {
	fs.mkdirSync(path.dirname(absBarrelPath), { recursive: true });
	const existing = fs.existsSync(absBarrelPath)
		? fs.readFileSync(absBarrelPath, "utf-8")
		: "";
	if (existing.includes(line)) {
		return `${relToRoot(absBarrelPath)} already has this export`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absBarrelPath, `${existing}${separator}${line}\n`);
	return `${relToRoot(absBarrelPath)} (+${line})`;
}

/**
 * Collapses one-or-more trailing newlines in `raw` down to exactly `count` newlines — a
 * non-regex equivalent of `raw.replace(/\n+$/, "\n".repeat(count))`. Written this way (rather
 * than the regex) because SonarCloud's regex-super-linear-backtracking check (typescript:S8786)
 * flagged that pattern repeated across this file/DatabaseGenerator.ts/GraphqlGenerator.ts; a
 * plain scan-backwards loop sidesteps the check entirely instead of trying to appease its
 * heuristic. Same "leave `raw` untouched if it has no trailing newline at all" behavior as the
 * `+`-quantified regex it replaces (`raw.replace(/\n+$/, ...)` only fires on 1+ matches).
 */
export function collapseTrailingNewlines(raw: string, count = 1): string {
	let end = raw.length;
	while (end > 0 && raw[end - 1] === "\n") end--;
	return end === raw.length ? raw : `${raw.slice(0, end)}${"\n".repeat(count)}`;
}

/**
 * Registers a newly-scaffolded <location>/<name>/Tiltfile in <location>'s own Tiltfile (itself
 * included by the root Tiltfile — see services/Tiltfile for the established pattern), so `tilt
 * up` from repo root actually brings it up. Shared by the "server" and "web" project generators,
 * both of which scaffold their own helm/ chart + Tiltfile but otherwise had no way to wire it in.
 */
export function appendRootTiltfileInclude(
	root: string,
	location: string,
	name: string,
): string {
	const locationTiltfilePath = path.join(root, location, "Tiltfile");
	if (!fs.existsSync(locationTiltfilePath)) {
		return `${path.relative(root, locationTiltfilePath)} not found, skipped`;
	}
	const line = `include("./${name}/Tiltfile")`;
	const raw = fs.readFileSync(locationTiltfilePath, "utf-8");
	if (raw.includes(line)) {
		return `${path.relative(root, locationTiltfilePath)} already includes ${name}`;
	}
	fs.writeFileSync(
		locationTiltfilePath,
		`${collapseTrailingNewlines(raw)}${line}\n`,
	);
	return `${path.relative(root, locationTiltfilePath)} (+${name})`;
}

/**
 * Reads one apps/servers/<name>'s .env.sample (new `<envVar>=N` convention) and src/app.ts
 * (demo1/demo2's pre-existing hardcoded `port: N` literal on the matching driver entry) for a
 * port already in use, adding whatever it finds to `usedPorts` — the per-server half of
 * findAvailableServerPort's scan, split out to keep that function's cognitive complexity down.
 */
function collectServerPortUsage(
	serverDir: string,
	envVar: string,
	driverName: string,
	usedPorts: Set<number>,
): void {
	const envSamplePath = path.join(serverDir, ".env.sample");
	if (fs.existsSync(envSamplePath)) {
		const match = new RegExp(String.raw`^${envVar}=(\d+)`, "m").exec(
			fs.readFileSync(envSamplePath, "utf-8"),
		);
		if (match) usedPorts.add(Number(match[1]));
	}

	const appPath = path.join(serverDir, "src", "app.ts");
	if (fs.existsSync(appPath)) {
		const match = new RegExp(
			String.raw`driver:\s*${driverName}[\s\S]{0,200}?port:\s*(\d+)`,
		).exec(fs.readFileSync(appPath, "utf-8"));
		if (match) usedPorts.add(Number(match[1]));
	}
}

/**
 * Scans every apps/servers/* /.env.sample and apps/servers/* /src/app.ts for a port already in use (see
 * collectServerPortUsage) and returns the lowest one >= defaultPort not already taken — shared by
 * GraphqlGenerator's findAvailableGraphqlPort (`envVar: "GRAPHQL_PORT"`, `driverName:
 * "ApolloDriver"`) and GrpcGenerator's findAvailableGrpcPort (`"GRPC_PORT"`, `"GrpcDriver"`),
 * which were otherwise identical aside from those three values.
 */
export function findAvailableServerPort(
	root: string,
	envVar: string,
	driverName: string,
	defaultPort: number,
): number {
	const serversDir = path.join(root, "apps", "servers");
	const usedPorts = new Set<number>();

	if (fs.existsSync(serversDir)) {
		for (const entry of fs.readdirSync(serversDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			collectServerPortUsage(
				path.join(serversDir, entry.name),
				envVar,
				driverName,
				usedPorts,
			);
		}
	}

	let port = defaultPort;
	while (usedPorts.has(port)) port++;
	return port;
}

// --- indented-block text splicing ---------------------------------------------------------------
//
// Text-splicing, not a YAML parse/stringify round-trip — a full round-trip would silently drop
// every hand-written comment elsewhere in the file. Shared by wireHelmDeploymentConfigMap below.

/**
 * Scans forward from immediately after `headerEndIndex` (the position right after a header
 * line's own newline) for the first non-blank line whose indentation is less than `bodyIndent`
 * spaces — i.e. the end of that header's indented body — or EOF. Shared primitive behind every
 * "find or create a nested block" helper below.
 */
function findIndentedBodyEnd(
	raw: string,
	headerEndIndex: number,
	bodyIndent: number,
): number {
	const lines = raw.slice(headerEndIndex).split("\n");
	let offset = headerEndIndex;
	for (const line of lines) {
		if (line.trim() !== "") {
			const indent = line.length - line.trimStart().length;
			if (indent < bodyIndent) return offset;
		}
		offset += line.length + 1;
	}
	return raw.length;
}

/**
 * Adds `- containerPort: <port>` to the app container's `ports:` list in a server's
 * helm/templates/deployment.yaml — same idempotent-splice shape as wireHelmDeploymentConfigMap
 * below (inserts right after the container's own `image:` line on first use, so a driver calling
 * both ends up with `ports:` above `envFrom:`), just scoped to `ports:` instead of `envFrom:`.
 * Without this, a driver's own port env var (e.g. GRPC_PORT) resolves fine inside the container
 * but nothing outside the pod — not even another pod on the same node — can reach it: confirmed
 * the hard way once already (see wireHelmDeploymentConfigMap's own `<name>-grpc-env`/
 * `<name>-graphql-env` callers). Idempotent per port number.
 */
export function wireHelmContainerPort(absDeploymentPath: string, port: number): string {
	const raw = fs.readFileSync(absDeploymentPath, "utf-8");
	if (new RegExp(`containerPort: ${port}\\b`).test(raw)) {
		return `${relToRoot(absDeploymentPath)} already exposes port ${port}`;
	}

	const portsLineMatch = /^(\s+)ports:[ \t]*\n/m.exec(raw);
	if (portsLineMatch) {
		const indent = portsLineMatch[1];
		const listStart = portsLineMatch.index + portsLineMatch[0].length;
		const insertAt = findIndentedBodyEnd(raw, listStart, indent.length + 1);
		const entry = `${indent}  - containerPort: ${port}\n`;
		fs.writeFileSync(
			absDeploymentPath,
			`${raw.slice(0, insertAt)}${entry}${raw.slice(insertAt)}`,
		);
		return `${relToRoot(absDeploymentPath)} (+containerPort ${port})`;
	}

	const imageLineMatch = /^(\s+)image: .*\n/m.exec(raw);
	if (!imageLineMatch) {
		throw new Error(`Could not find an "image:" line in ${absDeploymentPath}`);
	}
	const indent = imageLineMatch[1];
	const insertAt = imageLineMatch.index + imageLineMatch[0].length;
	const portsBlock = `${indent}ports:\n${indent}  - containerPort: ${port}\n`;
	fs.writeFileSync(
		absDeploymentPath,
		`${raw.slice(0, insertAt)}${portsBlock}${raw.slice(insertAt)}`,
	);
	return `${relToRoot(absDeploymentPath)} (+containerPort ${port})`;
}

/**
 * Adds `- configMapRef: name: <configMapName>` to the app container's `envFrom:` list in a
 * server's helm/templates/deployment.yaml — the k8s equivalent of wireComposeService's
 * `environment:` splice, but referencing a whole ConfigMap instead of individual entries (each
 * driver/extension owns its own ConfigMap, e.g. DatabaseGenerator's `<name>-env`, KafkaGenerator's
 * `<name>-kafka-env`). Creates the `envFrom:` list on first use; appends a new entry to it on
 * every call after, so multiple drivers/extensions on the same server each get their own line
 * without clobbering each other. Idempotent per configMapName.
 */
export function wireHelmDeploymentConfigMap(
	absDeploymentPath: string,
	configMapName: string,
	refKind: "configMapRef" | "secretRef" = "configMapRef",
): string {
	const raw = fs.readFileSync(absDeploymentPath, "utf-8");
	if (raw.includes(`name: ${configMapName}`)) {
		return `${relToRoot(absDeploymentPath)} already references ${configMapName}`;
	}

	const envFromLineMatch = /^(\s+)envFrom:[ \t]*\n/m.exec(raw);
	if (envFromLineMatch) {
		const indent = envFromLineMatch[1];
		const listStart = envFromLineMatch.index + envFromLineMatch[0].length;
		const insertAt = findIndentedBodyEnd(raw, listStart, indent.length + 1);
		const entry = `${indent}  - ${refKind}:\n${indent}      name: ${configMapName}\n`;
		fs.writeFileSync(
			absDeploymentPath,
			`${raw.slice(0, insertAt)}${entry}${raw.slice(insertAt)}`,
		);
		return `${relToRoot(absDeploymentPath)} (+envFrom ${configMapName})`;
	}

	const imageLineMatch = /^(\s+)image: .*\n/m.exec(raw);
	if (!imageLineMatch) {
		throw new Error(`Could not find an "image:" line in ${absDeploymentPath}`);
	}
	const indent = imageLineMatch[1];
	const insertAt = imageLineMatch.index + imageLineMatch[0].length;
	const envFromBlock = `${indent}envFrom:\n${indent}  - ${refKind}:\n${indent}      name: ${configMapName}\n`;
	fs.writeFileSync(
		absDeploymentPath,
		`${raw.slice(0, insertAt)}${envFromBlock}${raw.slice(insertAt)}`,
	);
	return `${relToRoot(absDeploymentPath)} (+envFrom ${configMapName})`;
}

/**
 * Adds a wait-loop initContainer to a server's helm/templates/deployment.yaml so the app
 * container never starts before a dependency (its own db/redis Deployment) is actually
 * accepting connections — k8s has no native `depends_on`, and envFrom alone only wires the
 * connection string, not readiness. Reuses the dependency's own image (already pulled for that
 * Deployment) rather than adding busybox as a new dependency. Idempotent per initContainer name.
 */
export function wireHelmInitContainerWait(
	absDeploymentPath: string,
	name: string,
	image: string,
	waitCommand: string,
): string {
	const raw = fs.readFileSync(absDeploymentPath, "utf-8");
	if (raw.includes(`name: ${name}`)) {
		return `${relToRoot(absDeploymentPath)} already has initContainer ${name}`;
	}

	const containersLineMatch = /^(\s+)containers:[ \t]*\n/m.exec(raw);
	if (!containersLineMatch) {
		throw new Error(`Could not find a "containers:" line in ${absDeploymentPath}`);
	}
	const indent = containersLineMatch[1];
	const entry = `${indent}  - name: ${name}\n${indent}    image: ${image}\n${indent}    command: ["sh", "-c", ${JSON.stringify(waitCommand)}]\n`;

	const initContainersLineMatch = /^(\s+)initContainers:[ \t]*\n/m.exec(raw);
	if (initContainersLineMatch) {
		const initIndent = initContainersLineMatch[1];
		const listStart =
			initContainersLineMatch.index + initContainersLineMatch[0].length;
		const insertAt = findIndentedBodyEnd(raw, listStart, initIndent.length + 1);
		fs.writeFileSync(
			absDeploymentPath,
			`${raw.slice(0, insertAt)}${entry}${raw.slice(insertAt)}`,
		);
		return `${relToRoot(absDeploymentPath)} (+initContainer ${name})`;
	}

	const insertAt = containersLineMatch.index;
	const block = `${indent}initContainers:\n${entry}`;
	fs.writeFileSync(
		absDeploymentPath,
		`${raw.slice(0, insertAt)}${block}${raw.slice(insertAt)}`,
	);
	return `${relToRoot(absDeploymentPath)} (+initContainer ${name})`;
}
