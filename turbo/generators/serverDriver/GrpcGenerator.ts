import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	ensureGenScript,
	findAvailableServerPort,
	injectDriverEntry,
	mergePackageJsonDeps,
	wireHealthcheckPrometheusJob,
	wireHelmContainerPort,
	wireHelmDeploymentConfigMap,
	writePackageJson,
} from "../helpers";
import type { ServerDriverExtension } from "./types";

const DEFAULT_GRPC_PORT = 5001;
const TEMPLATES_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "grpc");

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

function pascalCase(name: string): string {
	return name
		.split(/[-_]/)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

/**
 * Proto package names can't contain hyphens (unlike server workspace names, which are
 * kebab-case) — underscore-join the name for use as the stub's `package` declaration.
 */
function protoPackage(name: string): string {
	return name.replaceAll("-", "_");
}

/**
 * Merges the gRPC packages + "gen" script into an existing package.json, preserving that
 * file's own indentation style.
 */
function mergeGrpcIntoPackageJson(absPackageJsonPath: string): string {
	const { pkg, indent } = mergePackageJsonDeps(
		absPackageJsonPath,
		{ "@bufbuild/buf": "^1.70.0", protoc: "^35.1.0" },
		{ "@grpc/grpc-js": "^1.14.4", "ts-proto": "^2.11.8", api: "workspace:*" },
	);
	const genNote = ensureGenScript(pkg, absPackageJsonPath);
	writePackageJson(absPackageJsonPath, pkg, indent);
	return `${relToRoot(absPackageJsonPath)} (+@grpc/grpc-js, ts-proto, api, buf/protoc)${genNote}`;
}

/**
 * Appends GRPC_PORT to .env.sample (creating it if somehow missing) and, only if it already
 * exists, to .env too — .env is gitignored and may not exist in a fresh checkout.
 */
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

/**
 * Scans every apps/servers/* /.env.sample (new GRPC_PORT convention) and apps/servers/* /src/app.ts
 * (demo1/demo2's pre-existing hardcoded `port: N` literal on the GrpcDriver entry) for a
 * port already in use, and returns the lowest one >= DEFAULT_GRPC_PORT not already taken.
 */
function findAvailableGrpcPort(root: string): number {
	return findAvailableServerPort(root, "GRPC_PORT", "GrpcDriver", DEFAULT_GRPC_PORT);
}

function buildGrpcDriverEntry(itemIndent: string): string {
	return (
		`{\n${itemIndent}\tdriver: GrpcDriver,\n${itemIndent}\tport: Number(import.meta.env.GRPC_PORT),\n` +
		`${itemIndent}\tonReady: ({ host, port }) =>\n${itemIndent}\t\tconsole.log(\`gRPC server is running on \${host}:\${port}\`),\n${itemIndent}}`
	);
}

function registerActionTypes(plop: PlopTypes.NodePlopAPI): void {
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
		return injectDriverEntry(
			path.join(process.cwd(), location, "src", "app.ts"),
			"GrpcDriver",
			buildGrpcDriverEntry,
		);
	});

	plop.setActionType("addGrpcProtoFile", (answers, _config, plopApi) => {
		const { location } = answers as { location: string };
		const name = path.basename(location);
		const destPath = path.join(process.cwd(), location, "src", "schemas", "proto", `${name}.proto`);
		if (fs.existsSync(destPath)) {
			return `${relToRoot(destPath)} already exists`;
		}
		const template = fs.readFileSync(path.join(TEMPLATES_DIR, "schema.proto.hbs"), "utf-8");
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.writeFileSync(
			destPath,
			plopApi.renderString(template, { name: protoPackage(name), pascalName: pascalCase(name) }),
		);
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

	// Writes the <name>-grpc-env ConfigMap + a Service for this Deployment into this server's own
	// helm chart, wires containerPort + envFrom into deployment.yaml — without this, GRPC_PORT
	// resolves fine inside the container (from .env.sample/.env in local `bun run dev`) but the
	// pod exposes nothing and has no in-cluster DNS name, so nothing else can ever reach it.
	plop.setActionType("wireGrpcHelm", (answers, _config, plopApi) => {
		const { location } = answers as { location: string };
		const name = path.basename(location);

		// Runs after appendGrpcPortEnv, which already wrote GRPC_PORT to .env.sample — read it
		// back rather than recomputing findAvailableGrpcPort, which would now see that port as
		// taken (by this same server) and pick the next one instead (see GraphqlGenerator's
		// appendSupergraphSubgraph action for the identical guard).
		const envSamplePath = path.join(process.cwd(), location, ".env.sample");
		const envSample = fs.readFileSync(envSamplePath, "utf-8");
		const match = /^GRPC_PORT=(\d+)/m.exec(envSample);
		if (!match) {
			throw new Error(`Could not find GRPC_PORT in ${relToRoot(envSamplePath)}`);
		}
		const port = Number(match[1]);

		const template = fs.readFileSync(path.join(TEMPLATES_DIR, "helm-grpc-env.yaml.hbs"), "utf-8");
		const rendered = plopApi.renderString(template, { name, port });
		const helmTemplatesDir = path.join(process.cwd(), location, "helm", "templates");
		const destPath = path.join(helmTemplatesDir, "grpc-env.yaml");
		let chartResult: string;
		if (fs.existsSync(destPath)) {
			chartResult = `${relToRoot(destPath)} already exists`;
		} else {
			fs.mkdirSync(helmTemplatesDir, { recursive: true });
			fs.writeFileSync(destPath, rendered);
			chartResult = relToRoot(destPath);
		}

		const deploymentPath = path.join(helmTemplatesDir, "deployment.yaml");
		const portResult = wireHelmContainerPort(deploymentPath, port);
		const envResult = wireHelmDeploymentConfigMap(deploymentPath, `${name}-grpc-env`);
		// HealthCheckPlugin's own port (9000) — every server has it from scaffold (see
		// templates/server/src/app.ts), so it's wired here unconditionally, same as the Service's
		// own healthcheck port in helm-grpc-env.yaml.hbs, rather than gating it behind this
		// driver specifically.
		const healthPortResult = wireHelmContainerPort(deploymentPath, 9000);
		const prometheusResult = wireHealthcheckPrometheusJob(name);
		return `${chartResult}; ${portResult}; ${envResult}; ${healthPortResult}; ${prometheusResult}`;
	});
}

const GrpcGenerator: ServerDriverExtension = {
	value: "grpc",
	label: "gRPC",
	driverName: "GrpcDriver",
	registerActionTypes,
	actions: [
		{ type: "addGrpcProtoFile" },
		{ type: "addGrpcBufGenYaml" },
		{ type: "addGrpcPackageJson" },
		{ type: "appendGrpcPortEnv" },
		{ type: "injectGrpcDriver" },
		{ type: "wireGrpcHelm" },
	],
};

export default GrpcGenerator;
