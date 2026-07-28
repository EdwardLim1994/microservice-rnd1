import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addNamedImport,
	findMatchingBracket,
	wireHelmDeploymentConfigMap,
	workspaceChoices,
} from "../helpers";

const TEMPLATE_PATH = path.join(
	__dirname,
	"..",
	"templates",
	"redis.yaml.hbs",
);

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

/**
 * Eligible targets: any server without a redis.yaml chart yet — unlike the database extension,
 * Redis has no Prisma prerequisite.
 */
function findServersEligibleForRedis(root: string, serverWorkspaces: string[]) {
	return serverWorkspaces.filter(
		(location) =>
			!fs.existsSync(path.join(root, location, "helm", "templates", "redis.yaml")),
	);
}

/**
 * Adds RedisPlugin to the `.plugins([...])` array in app.ts — same "find marker, locate its
 * matching close bracket, splice before it" approach as helpers.ts's injectDriverEntry, but
 * targeting `.plugins([` specifically since ServerApp.plugins() always takes a bare array (no
 * single-entry form to handle, unlike ServerApp.init()).
 */
function injectRedisPlugin(absAppPath: string): string {
	let raw = fs.readFileSync(absAppPath, "utf-8");
	if (raw.includes("RedisPlugin")) {
		return `${relToRoot(absAppPath)} already has RedisPlugin`;
	}

	raw = addNamedImport(raw, "server", "RedisPlugin");

	const marker = ".plugins([";
	const markerIndex = raw.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(`Could not find "${marker}" in ${absAppPath}`);
	}
	const openBracketIndex = markerIndex + marker.length - 1;
	const closeBracketIndex = findMatchingBracket(raw, openBracketIndex, "[", "]");
	const inner = raw.slice(openBracketIndex + 1, closeBracketIndex).trim();
	const newInner = inner.length > 0 ? `${inner}, RedisPlugin` : "RedisPlugin";
	raw = `${raw.slice(0, openBracketIndex + 1)}${newInner}${raw.slice(closeBracketIndex)}`;

	fs.writeFileSync(absAppPath, raw);
	return `${relToRoot(absAppPath)} (+RedisPlugin)`;
}

export default class RedisGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		const eligible = findServersEligibleForRedis(process.cwd(), serverWorkspaces);

		plop.setActionType("injectRedisHelm", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const destPath = path.join(
				process.cwd(),
				location,
				"helm",
				"templates",
				"redis.yaml",
			);
			if (fs.existsSync(destPath)) {
				return `${relToRoot(destPath)} already exists`;
			}
			const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");
			fs.mkdirSync(path.dirname(destPath), { recursive: true });
			fs.writeFileSync(destPath, plop.renderString(template, { name }));
			return `${relToRoot(destPath)} (+${name}-redis)`;
		});

		plop.setActionType("wireRedisHelmDeployment", (answers) => {
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
				`${name}-redis-env`,
			);
		});

		plop.setActionType("injectRedisIntoServerApp", (answers) => {
			const { location } = answers as { location: string };
			return injectRedisPlugin(
				path.join(process.cwd(), location, "src", "app.ts"),
			);
		});

		plop.setGenerator("redis", {
			description:
				"Optionally add Redis to an existing server: a <name>-redis helm chart (Deployment/Service/ConfigMap, no PVC — dev cache), envFrom wiring into deployment.yaml, and RedisPlugin registered in app.ts's .plugins([...])",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						eligible,
						"No eligible server workspaces found — every server already has a redis.yaml, or none depend on the `server` framework package",
					),
				},
			],
			actions: [
				{ type: "injectRedisHelm" },
				{ type: "wireRedisHelmDeployment" },
				{ type: "injectRedisIntoServerApp" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new RedisGenerator(plop, serverWorkspaces);
	}
}
