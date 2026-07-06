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

const DEFAULT_FRONTEND_PORT = 3000;

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
