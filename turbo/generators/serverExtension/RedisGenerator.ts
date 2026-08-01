import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addNamedImport,
	collapseTrailingNewlines,
	findMatchingBracket,
	wireHelmDeploymentConfigMap,
	wireHelmInitContainerWait,
	workspaceChoices,
} from "../helpers";

const TEMPLATES_DIR = path.join(__dirname, "..", "templates");
const TEMPLATE_PATH = path.join(TEMPLATES_DIR, "redis.yaml.hbs");

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
 * Ensures helm/values.yaml has a `redisProvision:` block (schedule/defaultTtl/maxTtl for
 * redis-provision-job.yaml.hbs's CronJob) — creates the file fresh if the database extension
 * hasn't already made one, otherwise appends the block to it. Idempotent: skips if
 * `redisProvision:` is already present.
 */
function ensureRedisValuesBlock(absHelmDir: string): string {
	const valuesPath = path.join(absHelmDir, "values.yaml");
	const block = fs.readFileSync(
		path.join(TEMPLATES_DIR, "redis-values-block.yaml.hbs"),
		"utf-8",
	);

	if (!fs.existsSync(valuesPath)) {
		fs.writeFileSync(valuesPath, block);
		return `${relToRoot(valuesPath)} (created, +redisProvision)`;
	}

	const existing = fs.readFileSync(valuesPath, "utf-8");
	if (existing.includes("redisProvision:")) {
		return `${relToRoot(valuesPath)} already has redisProvision`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(valuesPath, `${existing}${separator}\n${block}`);
	return `${relToRoot(valuesPath)} (+redisProvision)`;
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
			const deploymentPath = path.join(
				process.cwd(),
				location,
				"helm",
				"templates",
				"deployment.yaml",
			);
			// secretRef, not configMapRef — REDIS_URL lives in <name>-redis-secret (holds
			// Vault-minted ACL user creds, rotated in place by redis-provision-job.yaml), there's
			// no non-secret redis env left to put in a ConfigMap.
			const secretResult = wireHelmDeploymentConfigMap(
				deploymentPath,
				`${name}-redis-secret`,
				"secretRef",
			);
			// A Service has no endpoints until its pod passes readinessProbe — without this wait
			// the app can boot pointed at a redis that isn't accepting connections yet.
			const waitResult = wireHelmInitContainerWait(
				deploymentPath,
				`wait-for-${name}-redis`,
				"redis:7-alpine",
				`until redis-cli -h ${name}-redis -p 6379 ping; do sleep 2; done`,
			);
			return `${secretResult}; ${waitResult}`;
		});

		// Vault-backed dynamic Redis ACL creds for the app's own Deployment (see
		// redis-provision-job.yaml.hbs) — a post-install/post-upgrade hook Job plus a recurring
		// CronJob, exactly like the database extension's db-provision-job.yaml.hbs, but its own
		// ServiceAccount/Role so this works whether or not that extension is also present.
		plop.setActionType(
			"injectRedisProvisionJob",
			(answers, _config, plopApi) => {
				const { location } = answers as { location: string };
				const name = path.basename(location);
				const helmDir = path.join(process.cwd(), location, "helm");

				const jobTemplate = fs.readFileSync(
					path.join(TEMPLATES_DIR, "redis-provision-job.yaml.hbs"),
					"utf-8",
				);
				const jobDestPath = path.join(
					helmDir,
					"templates",
					"redis-provision-job.yaml",
				);

				// Two scripts, not one — the Job/CronJob split into a vault-CLI initContainer
				// and a kubectl-only main container (neither image has both toolsets).
				const initDestPath = path.join(helmDir, "files", "redis-provision-init.sh");
				const mainDestPath = path.join(helmDir, "files", "redis-provision-main.sh");

				if (
					fs.existsSync(jobDestPath) ||
					fs.existsSync(initDestPath) ||
					fs.existsSync(mainDestPath)
				) {
					return `${relToRoot(jobDestPath)} already exists`;
				}
				fs.writeFileSync(jobDestPath, plopApi.renderString(jobTemplate, { name }));
				fs.mkdirSync(path.dirname(initDestPath), { recursive: true });
				for (const [templateName, destPath] of [
					["redis-provision-init.sh.hbs", initDestPath],
					["redis-provision-main.sh.hbs", mainDestPath],
				] as const) {
					const template = fs.readFileSync(
						path.join(TEMPLATES_DIR, templateName),
						"utf-8",
					);
					fs.writeFileSync(destPath, plopApi.renderString(template, { name }));
				}

				const valuesResult = ensureRedisValuesBlock(helmDir);
				return `${relToRoot(jobDestPath)}, ${relToRoot(initDestPath)}, ${relToRoot(mainDestPath)}, ${valuesResult} (+${name}-redis-provision Job/CronJob)`;
			},
		);

		plop.setActionType("appendRedisProvisionTiltfile", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const absTiltfilePath = path.join(process.cwd(), location, "Tiltfile");
			const raw = fs.readFileSync(absTiltfilePath, "utf-8");
			if (raw.includes(`${name}-redis-provision`)) {
				return `${relToRoot(absTiltfilePath)} already has ${name}-redis-provision resource`;
			}
			// "${name}-redis" (redis.yaml's Deployment) has no explicit k8s_resource() call
			// otherwise, so it'd fall into Tilt's default "unlabeled" UI bucket instead of
			// grouping with everything else here — give it one too, not just the provision job.
			// Tilt disambiguates same-named Job+CronJob pairs as "<name>:job"/"<name>:cronjob" —
			// a plain "${name}-redis-provision" isn't a valid resource name here. Also depends on
			// "${name}" itself, not just "${name}-redis": redis-provision-main.sh ends with
			// `kubectl rollout restart/status deployment/${name}` with no retry loop of its own, so
			// without this the Job can hit "deployment ${name} not found" if it runs before
			// ${name}'s own Deployment even exists yet and burn through backoffLimit needing a
			// manual re-trigger.
			const snippet =
				`\nk8s_resource(\n    "${name}-redis",\n    labels=["servers"],\n)\n\n` +
				`k8s_resource(\n    "${name}-redis-provision:job",\n    resource_deps=["${name}-redis", "${name}"],\n    labels=["servers"],\n)\n\n` +
				`k8s_resource(\n    "${name}-redis-provision:cronjob",\n    resource_deps=["${name}-redis", "${name}"],\n    labels=["servers"],\n)\n`;
			fs.writeFileSync(absTiltfilePath, `${collapseTrailingNewlines(raw)}\n${snippet}`);
			return `${relToRoot(absTiltfilePath)} (+${name}-redis-provision)`;
		});

		plop.setActionType("injectRedisIntoServerApp", (answers) => {
			const { location } = answers as { location: string };
			return injectRedisPlugin(
				path.join(process.cwd(), location, "src", "app.ts"),
			);
		});

		plop.setGenerator("redis", {
			description:
				"Optionally add Redis to an existing server: a <name>-redis helm chart (Deployment/Service, requirepass auth, no PVC — dev cache), a <name>-redis-provision Job/CronJob that mints Vault-backed dynamic Redis ACL creds into <name>-redis-secret by default, envFrom wiring into deployment.yaml, and RedisPlugin registered in app.ts's .plugins([...]) — RedisPlugin itself only ever reads REDIS_URL, so no app-side Vault client code is needed; see services/vault/CLAUDE.md for the provisioning story",
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
				{ type: "injectRedisProvisionJob" },
				{ type: "appendRedisProvisionTiltfile" },
				{ type: "wireRedisHelmDeployment" },
				{ type: "injectRedisIntoServerApp" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new RedisGenerator(plop, serverWorkspaces);
	}
}
