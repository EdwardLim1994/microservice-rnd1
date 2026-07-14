import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addApiScript,
	ensureGenScript,
	findAvailableServerPort,
	injectDriverEntry,
	mergePackageJsonDeps,
	syncHelmPort,
	writePackageJson,
} from "../helpers";
import type { ServerDriverExtension } from "./types";

const DEFAULT_GRAPHQL_PORT = 4001;
const TEMPLATES_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "graphql");
const SUPERGRAPH_YAML_PATH = path.join(
	process.cwd(),
	"services",
	"apollo",
	"src",
	"config",
	"supergraph.yaml",
);

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

function pascalCase(name: string): string {
	return name
		.split(/[-_]/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

// GraphQL field names can't contain hyphens (unlike server workspace names, which are
// kebab-case) — camelCase the name for use as the stub Query field.
function camelCase(name: string): string {
	const pascal = pascalCase(name);
	return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// Merges the GraphQL codegen packages + "gen" script into an existing package.json,
// preserving that file's own indentation style.
function mergeGraphqlIntoPackageJson(absPackageJsonPath: string): string {
	const { pkg, indent } = mergePackageJsonDeps(
		absPackageJsonPath,
		{
			"@graphql-codegen/add": "^7.0.1",
			"@graphql-codegen/cli": "^7.1.2",
			"@graphql-codegen/schema-ast": "^6.0.1",
			"@graphql-codegen/typescript": "^6.0.2",
			"@graphql-codegen/typescript-resolvers": "^6.0.2",
		},
		{ graphql: "^16.14.2", api: "workspace:*", script: "workspace:*" },
	);
	const genNote = ensureGenScript(pkg);
	writePackageJson(absPackageJsonPath, pkg, indent);
	return `${relToRoot(absPackageJsonPath)} (+graphql, api, script, @graphql-codegen/*)${genNote}`;
}

// Appends GRAPHQL_PORT to .env.sample (creating it if somehow missing) and, only if it already
// exists, to .env too — .env is gitignored and may not exist in a fresh checkout.
function appendGraphqlPort(absPath: string, port: number, createIfMissing: boolean): string | null {
	const line = `GRAPHQL_PORT=${port}`;
	if (!fs.existsSync(absPath)) {
		if (!createIfMissing) return null;
		fs.writeFileSync(absPath, `# GraphQL\n${line}\n`);
		return `${relToRoot(absPath)} (created, +GRAPHQL_PORT)`;
	}
	const existing = fs.readFileSync(absPath, "utf-8");
	if (existing.includes("GRAPHQL_PORT=")) {
		return `${relToRoot(absPath)} already has GRAPHQL_PORT`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absPath, `${existing}${separator}\n# GraphQL\n${line}\n`);
	return `${relToRoot(absPath)} (+GRAPHQL_PORT)`;
}

// Scans every servers/*/.env.sample (new GRAPHQL_PORT convention) and servers/*/src/app.ts
// (demo1/demo2's pre-existing hardcoded `port: N` literal on the ApolloDriver entry) for a
// port already in use, and returns the lowest one >= DEFAULT_GRAPHQL_PORT not already taken.
function findAvailableGraphqlPort(root: string): number {
	return findAvailableServerPort(root, "GRAPHQL_PORT", "ApolloDriver", DEFAULT_GRAPHQL_PORT);
}

function buildApolloDriverEntry(itemIndent: string): string {
	return (
		`{\n${itemIndent}\tdriver: ApolloDriver,\n${itemIndent}\tport: Number(import.meta.env.GRAPHQL_PORT),\n` +
		`${itemIndent}\tonReady: ({ host, port }) =>\n${itemIndent}\t\tconsole.log(\`GraphQL server is running on \${host}:\${port}\`),\n${itemIndent}}`
	);
}

// Finds the schema/graphql directory a server actually uses. demo1 uses "schemas/graphql"
// (plural, matching its "schemas/proto" sibling), demo2 uses "schema/graphql" (singular) — a
// pre-existing naming drift documented in servers/demo1/CLAUDE.md. New servers get the plural
// "schemas" form to match the repo's more common convention.
function graphqlSchemaDir(location: string): string {
	const absLocation = path.join(process.cwd(), location);
	if (fs.existsSync(path.join(absLocation, "src", "schema", "graphql"))) {
		return "schema";
	}
	return "schemas";
}

// Registers this server as a federation subgraph in services/apollo's supergraph.yaml, so
// `bun run supergraph` picks it up. Skips if the server is already listed.
function appendSupergraphSubgraph(location: string, name: string, port: number): string {
	if (!fs.existsSync(SUPERGRAPH_YAML_PATH)) {
		return `${relToRoot(SUPERGRAPH_YAML_PATH)} not found, skipped`;
	}
	const raw = fs.readFileSync(SUPERGRAPH_YAML_PATH, "utf-8");
	if (new RegExp(`\\n\\s+${name}:`).test(raw)) {
		return `${relToRoot(SUPERGRAPH_YAML_PATH)} already lists ${name}`;
	}

	const schemaAbsPath = path.join(
		process.cwd(),
		location,
		"src",
		graphqlSchemaDir(location),
		"graphql",
		`${name}.graphql`,
	);
	const schemaRelPath = path.relative(path.dirname(SUPERGRAPH_YAML_PATH), schemaAbsPath);

	const entry =
		`\n   ${name}:\n      routing_url: http://${name}:${port}\n` +
		`      schema:\n         file: ${schemaRelPath}\n`;

	fs.writeFileSync(SUPERGRAPH_YAML_PATH, `${raw.replace(/\n+$/, "\n")}${entry}`);
	return `${relToRoot(SUPERGRAPH_YAML_PATH)} (+${name})`;
}

function registerActionTypes(plop: PlopTypes.NodePlopAPI): void {
	plop.setActionType("addGraphqlApiScript", (answers) => {
		const { location } = answers as { location: string };
		return addApiScript(location);
	});

	plop.setActionType("addGraphqlCodegenConfig", (answers, _config, plopApi) => {
		const { location } = answers as { location: string };
		const name = path.basename(location);
		const template = fs.readFileSync(path.join(TEMPLATES_DIR, "codegen.ts.hbs"), "utf-8");
		const destPath = path.join(process.cwd(), location, "src", "configs", "graphql", "codegen.ts");
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.writeFileSync(
			destPath,
			plopApi.renderString(template, { name, pascalName: pascalCase(name) }),
		);
		return relToRoot(destPath);
	});

	plop.setActionType("addGraphqlSchemaFile", (answers, _config, plopApi) => {
		const { location } = answers as { location: string };
		const name = path.basename(location);
		const destPath = path.join(
			process.cwd(),
			location,
			"src",
			graphqlSchemaDir(location),
			"graphql",
			`${name}.graphql`,
		);
		if (fs.existsSync(destPath)) {
			return `${relToRoot(destPath)} already exists`;
		}
		const template = fs.readFileSync(path.join(TEMPLATES_DIR, "schema.graphql.hbs"), "utf-8");
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.writeFileSync(
			destPath,
			plopApi.renderString(template, {
				fieldName: camelCase(name),
				pascalName: pascalCase(name),
			}),
		);
		return relToRoot(destPath);
	});

	plop.setActionType("addGraphqlPackageJson", (answers) => {
		const { location } = answers as { location: string };
		return mergeGraphqlIntoPackageJson(path.join(process.cwd(), location, "package.json"));
	});

	plop.setActionType("appendGraphqlPortEnv", (answers) => {
		const { location } = answers as { location: string };
		const port = findAvailableGraphqlPort(process.cwd());
		const results = [
			appendGraphqlPort(path.join(process.cwd(), location, ".env.sample"), port, true),
			appendGraphqlPort(path.join(process.cwd(), location, ".env"), port, false),
		].filter((result): result is string => result !== null);
		return results.length > 0 ? results.join("; ") : "no .env files updated";
	});

	plop.setActionType("syncGraphqlHelmPort", (answers) => {
		// Runs after appendGraphqlPortEnv, which already wrote GRAPHQL_PORT to .env.sample —
		// read it back rather than recomputing findAvailableGraphqlPort, same reasoning as
		// appendSupergraphSubgraph below.
		const { location } = answers as { location: string };
		const envSamplePath = path.join(process.cwd(), location, ".env.sample");
		const envSample = fs.readFileSync(envSamplePath, "utf-8");
		const match = /^GRAPHQL_PORT=(\d+)/m.exec(envSample);
		if (!match) {
			throw new Error(`Could not find GRAPHQL_PORT in ${relToRoot(envSamplePath)}`);
		}
		return syncHelmPort(location, "graphql", Number(match[1]));
	});

	plop.setActionType("injectGraphqlDriver", (answers) => {
		const { location } = answers as { location: string };
		return injectDriverEntry(
			path.join(process.cwd(), location, "src", "app.ts"),
			"ApolloDriver",
			buildApolloDriverEntry,
		);
	});

	plop.setActionType("appendSupergraphSubgraph", (answers) => {
		// Runs after appendGraphqlPortEnv, which already wrote GRAPHQL_PORT to .env.sample —
		// read it back rather than recomputing findAvailableGraphqlPort, which would now see
		// that port as taken (by this same server) and pick the next one instead.
		const { location } = answers as { location: string };
		const name = path.basename(location);
		const envSamplePath = path.join(process.cwd(), location, ".env.sample");
		const envSample = fs.readFileSync(envSamplePath, "utf-8");
		const match = /^GRAPHQL_PORT=(\d+)/m.exec(envSample);
		if (!match) {
			throw new Error(`Could not find GRAPHQL_PORT in ${relToRoot(envSamplePath)}`);
		}
		return appendSupergraphSubgraph(location, name, Number(match[1]));
	});
}

const GraphqlGenerator: ServerDriverExtension = {
	value: "graphql",
	label: "GraphQL",
	driverName: "ApolloDriver",
	registerActionTypes,
	actions: [
		{ type: "addGraphqlApiScript" },
		{ type: "addGraphqlSchemaFile" },
		{ type: "addGraphqlCodegenConfig" },
		{ type: "addGraphqlPackageJson" },
		{ type: "appendGraphqlPortEnv" },
		{ type: "syncGraphqlHelmPort" },
		{ type: "injectGraphqlDriver" },
		{ type: "appendSupergraphSubgraph" },
	],
};

export default GraphqlGenerator;
