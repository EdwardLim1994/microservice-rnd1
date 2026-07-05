import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { detectIndent, workspaceChoices } from "../helpers";

const DEFAULT_GRPC_PORT = 5001;
const TEMPLATES_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "grpc");

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

// Merges the gRPC packages + "gen" script into an existing package.json, preserving that
// file's own indentation style. Unlike the database extension's "postinstall" (a lifecycle
// hook, safe to chain with &&), "gen" is a single named command — if it's already set to
// something else, we leave it alone and report it rather than silently overwriting it.
function mergeGrpcIntoPackageJson(absPackageJsonPath: string): string {
	const raw = fs.readFileSync(absPackageJsonPath, "utf-8");
	const indent = detectIndent(raw);
	const pkg = JSON.parse(raw);

	pkg.devDependencies ??= {};
	pkg.dependencies ??= {};
	pkg.scripts ??= {};

	pkg.devDependencies["@bufbuild/buf"] = "^1.70.0";
	pkg.devDependencies.protoc = "^35.1.0";
	pkg.dependencies["@grpc/grpc-js"] = "^1.14.4";
	pkg.dependencies["ts-proto"] = "^2.11.8";
	pkg.dependencies.api = "workspace:*";
	pkg.dependencies.script = "workspace:*";

	const genScript = "bun ./src/scripts/generate_api.sh.ts";
	const existingGen = pkg.scripts.gen as string | undefined;
	let genNote = "";
	if (!existingGen) {
		pkg.scripts.gen = genScript;
	} else if (existingGen !== genScript) {
		genNote = ` (scripts.gen already set to something else, left unchanged)`;
	}

	fs.writeFileSync(absPackageJsonPath, `${JSON.stringify(pkg, null, indent)}\n`);
	return `${relToRoot(absPackageJsonPath)} (+@grpc/grpc-js, ts-proto, api, script, buf/protoc)${genNote}`;
}

// Appends GRPC_PORT to .env.sample (creating it if somehow missing) and, only if it already
// exists, to .env too — .env is gitignored and may not exist in a fresh checkout.
function appendGrpcPort(absPath: string, port: number, createIfMissing: boolean): string | null {
	const line = `GRPC_PORT=${port}`;
	if (!fs.existsSync(absPath)) {
		if (!createIfMissing) return null;
		fs.writeFileSync(absPath, `# gRPC\n${line}\n`);
		return `${relToRoot(absPath)} (created, +GRPC_PORT)`;
	}
	const existing = fs.readFileSync(absPath, "utf-8");
	if (existing.includes("GRPC_PORT=")) {
		return `${relToRoot(absPath)} already has GRPC_PORT`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absPath, `${existing}${separator}\n# gRPC\n${line}\n`);
	return `${relToRoot(absPath)} (+GRPC_PORT)`;
}

// Scans every servers/*/.env.sample (new GRPC_PORT convention) and servers/*/src/app.ts
// (demo1/demo2's pre-existing hardcoded `port: N` literal on the GrpcDriver entry) for a
// port already in use, and returns the lowest one >= DEFAULT_GRPC_PORT not already taken.
function findAvailableGrpcPort(root: string): number {
	const serversDir = path.join(root, "servers");
	const usedPorts = new Set<number>();

	if (fs.existsSync(serversDir)) {
		for (const entry of fs.readdirSync(serversDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			const serverDir = path.join(serversDir, entry.name);

			const envSamplePath = path.join(serverDir, ".env.sample");
			if (fs.existsSync(envSamplePath)) {
				const match = /^GRPC_PORT=(\d+)/m.exec(fs.readFileSync(envSamplePath, "utf-8"));
				if (match) usedPorts.add(Number(match[1]));
			}

			const appPath = path.join(serverDir, "src", "app.ts");
			if (fs.existsSync(appPath)) {
				const match = /driver:\s*GrpcDriver[\s\S]{0,200}?port:\s*(\d+)/.exec(
					fs.readFileSync(appPath, "utf-8"),
				);
				if (match) usedPorts.add(Number(match[1]));
			}
		}
	}

	let port = DEFAULT_GRPC_PORT;
	while (usedPorts.has(port)) port++;
	return port;
}

// Scans forward from `openIndex` (which must point at `openChar`) counting nested
// open/close chars, returning the index of the matching close char.
function findMatchingBracket(
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

function addNamedImport(raw: string, source: string, importName: string): string {
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

// Rewrites `ServerApp.init(...)` to add a GrpcDriver entry — handling both the bare
// single-driver form (servers/templates/server's own scaffold, `ServerApp.init(CronDriver)`)
// and the array-of-entries form (servers/demo1's shape). Converting from the bare form also
// collapses its now-redundant `.run(() => \`...\`)` callback to a bare `.run()`, since once a
// driver has its own onReady, a single global "server is running" callback doesn't fit.
function injectGrpcDriverEntry(absAppPath: string): string {
	let raw = fs.readFileSync(absAppPath, "utf-8");
	if (raw.includes("GrpcDriver")) {
		return `${relToRoot(absAppPath)} already has GrpcDriver`;
	}

	raw = addNamedImport(raw, "server", "GrpcDriver");

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

	const entry =
		`{\n${itemIndent}\tdriver: GrpcDriver,\n${itemIndent}\tport: Number(import.meta.env.GRPC_PORT),\n` +
		`${itemIndent}\tonReady: ({ host, port }) =>\n${itemIndent}\t\tconsole.log(\`gRPC server is running on \${host}:\${port}\`),\n${itemIndent}}`;

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
	return `${relToRoot(absAppPath)} (+GrpcDriver)`;
}

export default class GrpcGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		plop.setActionType("addGrpcPackageJson", (answers) => {
			const { location } = answers as { location: string };
			return mergeGrpcIntoPackageJson(path.join(process.cwd(), location, "package.json"));
		});

		plop.setActionType("appendGrpcPortEnv", (answers) => {
			const { location } = answers as { location: string };
			const port = findAvailableGrpcPort(process.cwd());
			const results = [
				appendGrpcPort(path.join(process.cwd(), location, ".env.sample"), port, true),
				appendGrpcPort(path.join(process.cwd(), location, ".env"), port, false),
			].filter((result): result is string => result !== null);
			return results.length > 0 ? results.join("; ") : "no .env files updated";
		});

		plop.setActionType("injectGrpcDriver", (answers) => {
			const { location } = answers as { location: string };
			return injectGrpcDriverEntry(path.join(process.cwd(), location, "src", "app.ts"));
		});

		plop.setActionType("addGrpcApiScript", (answers, _config, plopApi) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const template = fs.readFileSync(
				path.join(TEMPLATES_DIR, "generate_api.sh.ts.hbs"),
				"utf-8",
			);
			const destPath = path.join(process.cwd(), location, "src", "scripts", "generate_api.sh.ts");
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.writeFileSync(destPath, plopApi.renderString(template, { name }));
			return relToRoot(destPath);
		});

		plop.setActionType("addGrpcBufGenYaml", (answers, _config, plopApi) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const template = fs.readFileSync(path.join(TEMPLATES_DIR, "buf.gen.yaml.hbs"), "utf-8");
			const destPath = path.join(process.cwd(), location, "src", "configs", "proto", "buf.gen.yaml");
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.writeFileSync(destPath, plopApi.renderString(template, { name }));
			return relToRoot(destPath);
		});

		plop.setGenerator("grpc", {
			description:
				"Add gRPC support to an existing server: package.json deps + gen script, generate_api.sh.ts, buf.gen.yaml, GRPC_PORT env, GrpcDriver wiring in app.ts",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						serverWorkspaces,
						"No server workspaces without gRPC already wired found under servers/**",
					),
				},
			],
			actions: [
				{ type: "addGrpcApiScript" },
				{ type: "addGrpcBufGenYaml" },
				{ type: "addGrpcPackageJson" },
				{ type: "appendGrpcPortEnv" },
				{ type: "injectGrpcDriver" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new GrpcGenerator(plop, serverWorkspaces);
	}
}
