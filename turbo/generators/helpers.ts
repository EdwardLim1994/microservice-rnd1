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

// Only servers/<name> that actually depend on the `server` framework package.
export function findServerWorkspaces(root: string): string[] {
	const serversDir = path.join(root, "servers");
	if (!fs.existsSync(serversDir)) return [];
	return fs
		.readdirSync(serversDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join("servers", entry.name))
		.filter((rel) => isServerWorkspace(path.join(root, rel)));
}

// Only servers that have a Prisma schema, i.e. actually have a PrismaClient for
// BaseRepository<PrismaClient> to be constructed against.
export function findPrismaServerWorkspaces(root: string): string[] {
	return findServerWorkspaces(root).filter((rel) =>
		fs.existsSync(path.join(root, rel, "src", "schemas", "prisma", "schema.prisma")),
	);
}

// The inverse: server workspaces that don't have a database yet, i.e. eligible
// targets for the "database" extension generator.
export function findServerWorkspacesWithoutPrisma(root: string): string[] {
	const withPrisma = new Set(findPrismaServerWorkspaces(root));
	return findServerWorkspaces(root).filter((rel) => !withPrisma.has(rel));
}

// Whether a server workspace already has the given driver wired up in its app.ts (matched by
// the driver's export name, e.g. "GrpcDriver"/"ApolloDriver"/"KafkaDriver") — the eligibility
// check behind the unified "extension" generator's per-server driver choices.
export function serverHasDriver(root: string, location: string, driverName: string): boolean {
	const appPath = path.join(root, location, "src", "app.ts");
	if (!fs.existsSync(appPath)) return false;
	return fs.readFileSync(appPath, "utf-8").includes(driverName);
}

// Shared "list" prompt choices for a location prompt, with a disabled placeholder
// when no eligible workspace was found.
export function workspaceChoices(
	workspaces: string[],
	emptyMessage: string,
): PlopTypes.PromptQuestion["choices"] {
	return workspaces.length > 0
		? workspaces
		: [{ name: emptyMessage, value: "", disabled: true }];
}

// Detects a file's own indentation style (servers are inconsistent: demo1 uses
// 2-space, demo2 uses tabs), so a JSON/TS rewrite can preserve it instead of clobbering it.
export function detectIndent(raw: string): string {
	const match = /\n([ \t]+)\S/.exec(raw);
	return match ? match[1] : "\t";
}

// Scans forward from `openIndex` (which must point at `openChar`) counting nested
// open/close chars, returning the index of the matching close char.
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
	throw new Error(`No matching "${closeChar}" found starting at index ${openIndex}`);
}

export function addNamedImport(raw: string, source: string, importName: string): string {
	const importRegex = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${source}["'];?`);
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
	names.sort();
	return raw.replace(importRegex, `import { ${names.join(", ")} } from "${source}";`);
}

// Like addNamedImport, but tolerates `source` not being imported yet — merges into an existing
// `import { ... } from "<source>"` if one exists, else adds a fresh import statement right after
// the last top-level import. Useful when the caller can't guarantee the target file already
// imports from that source (e.g. injecting a new page's import into a router file that may not
// yet import anything from that page's module).
export function addOrMergeNamedImport(raw: string, source: string, importName: string): string {
	const importRegex = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*["']${source}["'];?`);
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

// Merges devDependencies/dependencies into a package.json, preserving that file's own
// indentation style (servers are inconsistent: demo1 uses 2-space, demo2 uses tabs). Doesn't
// write the file — call writePackageJson once all merges (deps + gen script) are applied.
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

// Sets scripts.gen to the shared `generate_api.sh.ts` entrypoint (proto and/or GraphQL
// codegen, driven by APIGenerator) unless something else is already there — "gen" is a single
// named command, not a lifecycle hook, so if it's already set to something else we leave it
// alone and report it rather than silently overwriting it.
export function ensureGenScript(pkg: PackageJson): string {
	const genScript = "bun ./src/scripts/generate_api.sh.ts";
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

export function writePackageJson(absPackageJsonPath: string, pkg: PackageJson, indent: string): void {
	fs.writeFileSync(absPackageJsonPath, `${JSON.stringify(pkg, null, indent)}\n`);
}

const SHARED_TEMPLATES_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "shared");

// Writes the shared, protocol-agnostic generate_api.sh.ts script (proto + GraphQL codegen,
// via APIGenerator) unless one is already there — gRPC and GraphQL extensions both need it,
// so whichever extension is added first creates it.
export function addApiScript(location: string): string {
	const name = path.basename(location);
	const destPath = path.join(process.cwd(), location, "src", "scripts", "generate_api.sh.ts");
	if (fs.existsSync(destPath)) {
		return `${relToRoot(destPath)} already exists`;
	}
	const template = fs.readFileSync(
		path.join(SHARED_TEMPLATES_DIR, "generate_api.sh.ts.hbs"),
		"utf-8",
	);
	fs.mkdirSync(path.dirname(destPath), { recursive: true });
	fs.writeFileSync(destPath, template.replace(/\{\{\s*name\s*\}\}/g, name));
	return relToRoot(destPath);
}

// Rewrites `ServerApp.init(...)` to add a driver entry — handling both the bare
// single-driver form (servers/templates/server's own scaffold, `ServerApp.init(CronDriver)`)
// and the array-of-entries form (servers/demo1's shape). Converting from the bare form also
// collapses its now-redundant `.run(() => \`...\`)` callback to a bare `.run()`, since once a
// driver has its own onReady, a single global "server is running" callback doesn't fit.
// `buildEntry(itemIndent)` renders the `{ driver: ..., ... }` object literal text (no trailing
// comma). `extraImports` adds further named imports from "server" alongside the driver itself
// (e.g. KafkaDriver's entry also references SchemaRegistryKafkaSerializer).
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
		const closeBracketIndex = findMatchingBracket(raw, openBracketIndex, "[", "]");
		const inner = raw.slice(openBracketIndex + 1, closeBracketIndex).replace(/\s*$/, "");
		const separator = inner.trim() === "" || inner.trim().endsWith(",") ? "" : ",";
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
	const existing = fs.existsSync(absBarrelPath) ? fs.readFileSync(absBarrelPath, "utf-8") : "";
	if (existing.includes(line)) {
		return `${absBarrelPath} already exports ${name}`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absBarrelPath, `${existing}${separator}${line}\n`);
	return `${absBarrelPath} (+${name})`;
}

// Registers the "appendBarrel" custom action, shared by usecase/repository/interceptor/router
// generators: appends `export { default as <name> } from "./<name>";` to <location>/src/<folder>/index.ts,
// creating the folder/barrel if it doesn't exist yet.
export function registerAppendBarrelAction(plop: PlopTypes.NodePlopAPI): void {
	plop.setActionType("appendBarrel", (answers, config) => {
		const { location, name } = answers as { location: string; name: string };
		const { folder } = (config.data ?? {}) as { folder: string };
		const absBarrel = path.join(process.cwd(), location, "src", folder, "index.ts");
		return appendBarrelExport(absBarrel, name);
	});
}

// "web" (Rsbuild) is matched by rsbuild.config.ts, "native" (Expo/React Native) by
// metro.config.js — a "react-dom" dependency check isn't reliable since apps/mobile's
// package.json happens to list one too.
export function frontendPlatform(root: string, location: string): "web" | "native" | null {
	if (fs.existsSync(path.join(root, location, "rsbuild.config.ts"))) return "web";
	if (fs.existsSync(path.join(root, location, "metro.config.js"))) return "native";
	return null;
}

// React frontend workspaces (web or native) under apps/* and frontends/* — see
// frontendPlatform for how each is told apart.
export function findFrontendWorkspaces(root: string): string[] {
	return ["apps", "frontends"].flatMap((dir) => {
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

// Scans every apps/*/rsbuild.config.ts and frontends/*/rsbuild.config.ts for a dev server port
// already in use (matched within its `server: { ... port: N ... }` block specifically, not the
// `dev.assetPrefix` string which embeds the same port number in a different spot) and returns
// the lowest one >= DEFAULT_FRONTEND_PORT not already taken — e.g. apps/portal has 3000 and
// frontends/frontend1 has 3001, so a third project gets 3002.
export function findAvailableFrontendPort(root: string): number {
	const usedPorts = new Set<number>();

	for (const dir of ["apps", "frontends"]) {
		const base = path.join(root, dir);
		if (!fs.existsSync(base)) continue;
		for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const configPath = path.join(base, entry.name, "rsbuild.config.ts");
			if (!fs.existsSync(configPath)) continue;
			const match = /server:\s*\{[^}]*port:\s*(\d+)/s.exec(fs.readFileSync(configPath, "utf-8"));
			if (match) usedPorts.add(Number(match[1]));
		}
	}

	let port = DEFAULT_FRONTEND_PORT;
	while (usedPorts.has(port)) port++;
	return port;
}

const DEFAULT_MOBILE_PORT = 3011;

// Scans every apps/*/package.json for a `--port N` already used in its "dev" script (Expo's
// dev-server/tunnel port — apps/mobile's own is `expo start --host tunnel --port 3011`) and
// returns the lowest one >= DEFAULT_MOBILE_PORT not already taken. Harmless to scan every
// apps/* workspace, not just Expo ones — an Rsbuild-based app's "dev" script ("rsbuild --open")
// never matches the `--port` pattern, so it's simply skipped.
export function findAvailableMobilePort(root: string): number {
	const usedPorts = new Set<number>();

	const appsDir = path.join(root, "apps");
	if (fs.existsSync(appsDir)) {
		for (const entry of fs.readdirSync(appsDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const pkgPath = path.join(appsDir, entry.name, "package.json");
			if (!fs.existsSync(pkgPath)) continue;
			const devScript = JSON.parse(fs.readFileSync(pkgPath, "utf-8")).scripts?.dev as
				| string
				| undefined;
			const match = devScript ? /--port\s+(\d+)/.exec(devScript) : null;
			if (match) usedPorts.add(Number(match[1]));
		}
	}

	let port = DEFAULT_MOBILE_PORT;
	while (usedPorts.has(port)) port++;
	return port;
}

// Existing modules (each a directory) under <location>/src/modules — the eligible targets for
// the page/viewmodel/component generators, which add into a module rather than create one.
export function findFrontendModules(root: string, location: string): string[] {
	const modulesDir = path.join(root, location, "src", "modules");
	if (!fs.existsSync(modulesDir)) return [];
	return fs
		.readdirSync(modulesDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

// Appends a raw export line to a barrel file (creating the folder/file if missing) — the
// frontend module convention uses both named re-exports (pages: `export { X } from './X';`,
// matching frontend1's src/modules/demo1/pages/index.ts) and wildcard re-exports (viewmodel/
// types: `export * from './x';`), so this takes the fully-formed line rather than assuming one
// style, unlike the backend's appendBarrelExport.
export function appendBarrelLine(absBarrelPath: string, line: string): string {
	fs.mkdirSync(path.dirname(absBarrelPath), { recursive: true });
	const existing = fs.existsSync(absBarrelPath) ? fs.readFileSync(absBarrelPath, "utf-8") : "";
	if (existing.includes(line)) {
		return `${relToRoot(absBarrelPath)} already has this export`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absBarrelPath, `${existing}${separator}${line}\n`);
	return `${relToRoot(absBarrelPath)} (+${line})`;
}

// Registers a newly-scaffolded <location>/<name>/docker-compose.yml in the root
// docker-compose.yml's `include:` list, so `docker compose up` from repo root actually brings
// it up — shared by the "server" and "web" project generators, both of which scaffold their own
// docker-compose.yml but otherwise had no way to wire it into the root project.
export function appendRootComposeInclude(root: string, location: string, name: string): string {
	const rootComposePath = path.join(root, "docker-compose.yml");
	if (!fs.existsSync(rootComposePath)) {
		return `${path.relative(root, rootComposePath)} not found, skipped`;
	}
	const line = `  - ./${location}/${name}/docker-compose.yml`;
	const raw = fs.readFileSync(rootComposePath, "utf-8");
	if (raw.includes(line)) {
		return `${path.relative(root, rootComposePath)} already includes ${location}/${name}`;
	}
	fs.writeFileSync(rootComposePath, `${raw.replace(/\n+$/, "\n")}${line}\n`);
	return `${path.relative(root, rootComposePath)} (+${location}/${name})`;
}

// Recursively copies srcDir to destDir, substituting every `{{ key }}` (whitespace-tolerant)
// with its value from `replacements` — a plain, targeted string substitution, NOT Handlebars
// compilation. Used for helm/terraform deploy scaffolding (servers/demo1/helm's own
// `{{ include "server.fullname" . | nindent 4 }}`-style Go-template syntax, and every
// terraform/*.tf file's HCL `${ }` interpolation) that must survive verbatim into the generated
// output — running these through plop's addMany (full Handlebars compilation) would try, and
// fail, to parse `{{ include ... }}` as a Handlebars expression. This only ever touches the
// literal text `{{ <key> }}` for keys actually passed in `replacements`, leaving every other
// `{{ ... }}`/`${ ... }` alone — safe regardless of what other template syntax a file contains.
export function copyWithSubstitutions(
	srcDir: string,
	destDir: string,
	replacements: Record<string, string>,
): void {
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const srcPath = path.join(srcDir, entry.name);
		const destPath = path.join(destDir, entry.name);
		if (entry.isDirectory()) {
			fs.mkdirSync(destPath, { recursive: true });
			copyWithSubstitutions(srcPath, destPath, replacements);
			continue;
		}
		let raw = fs.readFileSync(srcPath, "utf-8");
		for (const [key, value] of Object.entries(replacements)) {
			raw = raw.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
		}
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.writeFileSync(destPath, raw);
	}
}

// Keeps <location>/helm/values.yaml's ports.<key> in sync with whatever port
// GraphqlGenerator/GrpcGenerator actually assigned (findAvailableGraphqlPort/
// findAvailableGrpcPort auto-increment past ports already used by other servers, so the
// assigned port won't always match the chart's 4001/5001 defaults) — shared by both generators
// since they only differ in which values.yaml key and .env.sample var they're syncing from.
// Skipped (not an error) if helm/values.yaml doesn't exist (a server predating this generator
// enhancement) or has no "ports.<key>:" entry to update.
export function syncHelmPort(location: string, key: "graphql" | "grpc", port: number): string {
	const absPath = path.join(process.cwd(), location, "helm", "values.yaml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	const raw = fs.readFileSync(absPath, "utf-8");
	const pattern = new RegExp(`(^\\s*${key}:\\s*)\\d+`, "m");
	if (!pattern.test(raw)) {
		return `${relToRoot(absPath)} has no "${key}:" port entry, skipped`;
	}
	fs.writeFileSync(absPath, raw.replace(pattern, `$1${port}`));
	return `${relToRoot(absPath)} (ports.${key} -> ${port})`;
}

// --- docker-compose.yml service-block editing -------------------------------------------------
//
// Text-splicing, not a YAML parse/stringify round-trip — consistent with every other generator
// action in this file (e.g. injectDockerComposeServices/ensureAdminerNetworkDeclared in
// DatabaseGenerator.ts) and deliberately so: a full YAML round-trip would silently drop every
// hand-written comment elsewhere in the file (docker-compose.yml files in this repo routinely
// have them — see servers/test1/docker-compose.yml), not just in whatever block is being edited.
// All of the below assumes this repo's consistent 2-space YAML indentation (service names at 2
// spaces, service body keys at 4, list items/map entries under those at 6, and so on).

// Scans forward from immediately after `headerEndIndex` (the position right after a header
// line's own newline) for the first non-blank line whose indentation is less than `bodyIndent`
// spaces — i.e. the end of that header's indented body — or EOF. Shared primitive behind every
// "find or create a nested block" helper below.
function findIndentedBodyEnd(raw: string, headerEndIndex: number, bodyIndent: number): number {
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

// Finds a top-level `services:` entry's own body range (everything indented under `  <name>:`),
// e.g. for locating servers/<name>/docker-compose.yml's main app service. Returns null if that
// service isn't declared in the file at all.
function findComposeServiceBody(raw: string, serviceName: string): { start: number; end: number } | null {
	const header = new RegExp(`^  ${serviceName}:[ \\t]*\\n`, "m").exec(raw);
	if (!header) return null;
	const start = header.index + header[0].length;
	return { start, end: findIndentedBodyEnd(raw, start, 4) };
}

// Returns the offset of the end of the last non-blank line within raw.slice(start, end) — i.e.
// `end` pulled back before any trailing blank-line run. Insertion points are computed from a
// block's full dedent boundary (findIndentedBodyEnd), which can land after a blank line some
// earlier edit left as a section separator (e.g. ensureComposeNetworkDeclared's blank line before
// the top-level `networks:` section) — inserting new content there would land the new lines
// *after* that separator, visually detached from the block they actually belong to.
function trimTrailingBlankLines(raw: string, start: number, end: number): number {
	const trimmedLength = raw.slice(start, end).replace(/\n+$/, "\n").length;
	return start + trimmedLength;
}

// Renders one `key: value` map entry line — plain `key: value` for a scalar, or `key:` (no
// trailing space) followed by `value`'s own already-indented continuation lines when `value`
// itself starts with a newline (a nested map, e.g. depends_on's per-service `condition:` block).
function renderMapEntryLine(key: string, value: string): string {
	return value.startsWith("\n") ? `${key}:${value}` : `${key}: ${value}`;
}

// Ensures `  <serviceName>:` has a `    <mapKey>:` sub-block (creating an empty one at the end
// of the service body if missing) containing every `entries` pair not already present as a
// `      <key>: ...` line — used for both `environment:` (mapKey="environment", entries are
// plain `KEY: value`) and a `depends_on:` map whose values are themselves nested maps (pass
// pre-rendered multi-line entries, e.g. `kafka:\n    condition: service_healthy`, indented for
// the depends_on map's own entry level by the caller).
function ensureComposeServiceMapEntries(
	raw: string,
	serviceName: string,
	mapKey: string,
	entries: Record<string, string>,
): string {
	const service = findComposeServiceBody(raw, serviceName);
	if (!service) return raw;

	const mapHeader = new RegExp(`^    ${mapKey}:[ \\t]*\\n`, "m");
	const withinService = raw.slice(service.start, service.end);
	const mapMatch = mapHeader.exec(withinService);

	if (mapMatch) {
		const mapStart = service.start + mapMatch.index + mapMatch[0].length;
		const mapEnd = findIndentedBodyEnd(raw, mapStart, 6);
		const missing = Object.entries(entries).filter(
			([key]) => !new RegExp(`^      ${key}:`, "m").test(raw.slice(mapStart, mapEnd)),
		);
		if (missing.length === 0) return raw;
		const insertAt = trimTrailingBlankLines(raw, mapStart, mapEnd);
		const lines = missing.map(([key, value]) => `      ${renderMapEntryLine(key, value)}\n`).join("");
		return `${raw.slice(0, insertAt)}${lines}${raw.slice(insertAt)}`;
	}

	const block = `    ${mapKey}:\n${Object.entries(entries)
		.map(([key, value]) => `      ${renderMapEntryLine(key, value)}\n`)
		.join("")}`;
	const insertAt = trimTrailingBlankLines(raw, service.start, service.end);
	return `${raw.slice(0, insertAt)}${block}${raw.slice(insertAt)}`;
}

// Same idea as ensureComposeServiceMapEntries, but for a `    networks:` YAML list (`      -
// item`) instead of a map.
function ensureComposeServiceListItems(
	raw: string,
	serviceName: string,
	listKey: string,
	items: string[],
): string {
	const service = findComposeServiceBody(raw, serviceName);
	if (!service) return raw;

	const listHeader = new RegExp(`^    ${listKey}:[ \\t]*\\n`, "m");
	const withinService = raw.slice(service.start, service.end);
	const listMatch = listHeader.exec(withinService);

	if (listMatch) {
		const listStart = service.start + listMatch.index + listMatch[0].length;
		const listEnd = findIndentedBodyEnd(raw, listStart, 6);
		const existing = raw.slice(listStart, listEnd);
		const missing = items.filter((item) => !new RegExp(`^\\s*-\\s*${item}\\s*$`, "m").test(existing));
		if (missing.length === 0) return raw;
		const insertAt = trimTrailingBlankLines(raw, listStart, listEnd);
		const lines = missing.map((item) => `      - ${item}\n`).join("");
		return `${raw.slice(0, insertAt)}${lines}${raw.slice(insertAt)}`;
	}

	const block = `    ${listKey}:\n${items.map((item) => `      - ${item}\n`).join("")}`;
	const insertAt = trimTrailingBlankLines(raw, service.start, service.end);
	return `${raw.slice(0, insertAt)}${block}${raw.slice(insertAt)}`;
}

// Ensures the top-level `networks:` stanza declares `<networkName>:` with an empty body — the
// "real" definition (driver: bridge) lives wherever that network actually originates (e.g.
// services/kafka/docker-compose.yml for "kafka"); Compose merges same-named top-level networks
// across every file pulled in by the root docker-compose.yml's `include:`, so an empty
// re-declaration here is enough. Creates the whole `networks:` section if the file doesn't have
// one yet.
export function ensureComposeNetworkDeclared(absComposePath: string, networkName: string): string {
	if (!fs.existsSync(absComposePath)) {
		return `${relToRoot(absComposePath)} not found, skipped`;
	}
	const raw = fs.readFileSync(absComposePath, "utf-8");
	if (new RegExp(`^  ${networkName}:`, "m").test(raw) && /^networks:\s*$/m.test(raw)) {
		// Only treat as already-declared if it's under a real top-level `networks:` section —
		// a same-named service/env key elsewhere shouldn't false-positive this check.
		const networksIndex = raw.search(/^networks:\s*$/m);
		if (networksIndex !== -1 && raw.indexOf(`\n  ${networkName}:`, networksIndex) !== -1) {
			return `${relToRoot(absComposePath)} already declares ${networkName}`;
		}
	}
	const next = /^networks:\s*$/m.test(raw)
		? raw.replace(/^networks:\s*$/m, `networks:\n  ${networkName}:`)
		: `${raw.replace(/\n+$/, "\n")}\nnetworks:\n  ${networkName}:\n`;
	fs.writeFileSync(absComposePath, next);
	return `${relToRoot(absComposePath)} (+${networkName} network)`;
}

// Wires an existing service in docker-compose.yml onto a Docker network, with `environment:`
// overrides (for env vars that otherwise come from .env — written for host-based `bun run dev`
// and meaningless inside a container, see servers/test1/docker-compose.yml's comments for the
// full story) and `depends_on:` entries for startup ordering. Skips (returns a "not found"
// message) if the target service doesn't exist in the file — same "skip, don't error" convention
// as syncHelmPort/addKafkaHelmValues for a server predating whatever's calling this.
export function wireComposeService(
	location: string,
	serviceName: string,
	options: {
		networks: string[];
		environment: Record<string, string>;
		dependsOn: Record<string, string>;
	},
): string {
	const absPath = path.join(process.cwd(), location, "docker-compose.yml");
	if (!fs.existsSync(absPath)) {
		return `${relToRoot(absPath)} not found, skipped`;
	}
	let raw = fs.readFileSync(absPath, "utf-8");

	if (Object.keys(options.environment).length > 0) {
		raw = ensureComposeServiceMapEntries(raw, serviceName, "environment", options.environment);
	}
	if (options.networks.length > 0) {
		raw = ensureComposeServiceListItems(raw, serviceName, "networks", options.networks);
	}
	if (Object.keys(options.dependsOn).length > 0) {
		const dependsOnEntries = Object.fromEntries(
			Object.entries(options.dependsOn).map(([service, condition]) => [
				service,
				`\n        condition: ${condition}`,
			]),
		);
		raw = ensureComposeServiceMapEntries(raw, serviceName, "depends_on", dependsOnEntries);
	}

	fs.writeFileSync(absPath, raw);
	for (const networkName of options.networks) {
		ensureComposeNetworkDeclared(absPath, networkName);
	}
	return `${relToRoot(absPath)} (${serviceName}: +networks/environment/depends_on)`;
}
