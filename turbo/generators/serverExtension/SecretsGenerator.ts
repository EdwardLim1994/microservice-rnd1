import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addNamedImport,
	findMatchingBracket,
	wireHelmDeploymentConfigMap,
	workspaceChoices,
} from "../helpers";

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

/**
 * Eligible targets: any server without a serviceaccount.yaml chart yet — like the redis
 * extension, this has no Prisma prerequisite.
 */
function findServersEligibleForSecrets(root: string, serverWorkspaces: string[]) {
	return serverWorkspaces.filter(
		(location) =>
			!fs.existsSync(
				path.join(root, location, "helm", "templates", "serviceaccount.yaml"),
			),
	);
}

/**
 * Splices `serviceAccountName: {{name}}` into a server's helm/templates/deployment.yaml, right
 * before the pod spec's own `containers:` list — the identity OpenBao's server-side templated
 * policy (see services/openbao/helm/files/k8s-auth-provision.sh) scopes secret access by, so it
 * has to be a real, unique-per-server ServiceAccount even though every server shares the
 * "server-apps" namespace (same "prefix by the server's own name" convention already used
 * everywhere else in this repo — apps/terraform/main.tf's own header comment). Idempotent: skips
 * if already present.
 */
function wireServiceAccountName(absDeploymentPath: string, name: string): string {
	const raw = fs.readFileSync(absDeploymentPath, "utf-8");
	if (raw.includes("serviceAccountName:")) {
		return `${relToRoot(absDeploymentPath)} already has serviceAccountName`;
	}

	const containersLineMatch = /^(\s+)containers:[ \t]*\n/m.exec(raw);
	if (!containersLineMatch) {
		throw new Error(`Could not find a "containers:" line in ${absDeploymentPath}`);
	}
	const indent = containersLineMatch[1];
	const entry = `${indent}serviceAccountName: ${name}\n`;
	const insertAt = containersLineMatch.index;
	fs.writeFileSync(
		absDeploymentPath,
		`${raw.slice(0, insertAt)}${entry}${raw.slice(insertAt)}`,
	);
	return `${relToRoot(absDeploymentPath)} (+serviceAccountName ${name})`;
}

/**
 * Adds OpenBaoPlugin to the `.plugins([...])` array in app.ts — same splice technique as
 * RedisGenerator's injectRedisPlugin.
 */
function injectOpenBaoPlugin(absAppPath: string): string {
	let raw = fs.readFileSync(absAppPath, "utf-8");
	if (raw.includes("OpenBaoPlugin")) {
		return `${relToRoot(absAppPath)} already has OpenBaoPlugin`;
	}

	raw = addNamedImport(raw, "server", "OpenBaoPlugin");

	const marker = ".plugins([";
	const markerIndex = raw.indexOf(marker);
	if (markerIndex === -1) {
		throw new Error(`Could not find "${marker}" in ${absAppPath}`);
	}
	const openBracketIndex = markerIndex + marker.length - 1;
	const closeBracketIndex = findMatchingBracket(raw, openBracketIndex, "[", "]");
	const inner = raw.slice(openBracketIndex + 1, closeBracketIndex).trim();
	const newInner = inner.length > 0 ? `${inner}, OpenBaoPlugin` : "OpenBaoPlugin";
	raw = `${raw.slice(0, openBracketIndex + 1)}${newInner}${raw.slice(closeBracketIndex)}`;

	fs.writeFileSync(absAppPath, raw);
	return `${relToRoot(absAppPath)} (+OpenBaoPlugin)`;
}

export default class SecretsGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		const eligible = findServersEligibleForSecrets(process.cwd(), serverWorkspaces);

		plop.setActionType("injectSecretsServiceAccount", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const helmDir = path.join(process.cwd(), location, "helm");
			const saPath = path.join(helmDir, "templates", "serviceaccount.yaml");
			if (fs.existsSync(saPath)) {
				return `${relToRoot(saPath)} already exists`;
			}
			fs.mkdirSync(path.dirname(saPath), { recursive: true });
			fs.writeFileSync(
				saPath,
				// This server's own OpenBao Kubernetes-auth identity — see
				// services/openbao/helm/files/k8s-auth-provision.sh's own header comment for why one
				// shared role + one identity-templated policy scopes access by this ServiceAccount's
				// own name, not a per-server role/policy provisioned here.
				`apiVersion: v1\nkind: ServiceAccount\nmetadata:\n  name: ${name}\n  namespace: {{ .Values.namespace }}\n`,
			);

			const deploymentPath = path.join(helmDir, "templates", "deployment.yaml");
			const wireResult = wireServiceAccountName(deploymentPath, name);
			return `${relToRoot(saPath)} (+${name} ServiceAccount); ${wireResult}`;
		});

		plop.setActionType("injectSecretsEnvConfigMap", (answers) => {
			const { location } = answers as { location: string };
			const name = path.basename(location);
			const helmDir = path.join(process.cwd(), location, "helm");
			const configMapName = `${name}-openbao-env`;
			const cmPath = path.join(helmDir, "templates", "openbao-env.yaml");
			if (fs.existsSync(cmPath)) {
				return `${relToRoot(cmPath)} already exists`;
			}
			fs.mkdirSync(path.dirname(cmPath), { recursive: true });
			fs.writeFileSync(
				cmPath,
				// Fixed values, not per-server — every server talks to the one shared OpenBao instance
				// (services/openbao, Terraform-applied) via the one shared "server-app-secrets" role
				// (see k8s-auth-provision.sh); the templated policy is what scopes each server to its
				// own path, not a per-server role name.
				"# Non-secret — Kubernetes auth needs only this pod's own already-mounted ServiceAccount\n" +
					"# token (see serviceaccount.yaml), no credential to inject here.\n" +
					`apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${configMapName}\n  namespace: {{ .Values.namespace }}\ndata:\n  OPENBAO_ADDR: "http://openbao.infra.svc.cluster.local:8200"\n  OPENBAO_ROLE: "server-app-secrets"\n`,
			);

			const deploymentPath = path.join(helmDir, "templates", "deployment.yaml");
			const wireResult = wireHelmDeploymentConfigMap(deploymentPath, configMapName);
			return `${relToRoot(cmPath)} (+${configMapName}); ${wireResult}`;
		});

		plop.setActionType("injectOpenBaoIntoServerApp", (answers) => {
			const { location } = answers as { location: string };
			return injectOpenBaoPlugin(
				path.join(process.cwd(), location, "src", "app.ts"),
			);
		});

		plop.setGenerator("secrets", {
			description:
				"Optionally add app-level secrets access to an existing server: a dedicated per-server ServiceAccount (the identity OpenBao's own templated policy scopes access by), OPENBAO_ADDR/OPENBAO_ROLE env wiring into deployment.yaml, and OpenBaoPlugin registered in app.ts's .plugins([...]) — for API keys/JWT signing keys/third-party creds only, never DB/Redis credentials (those stay static, see the database/redis extensions)",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						eligible,
						"No eligible server workspaces found — every server already has a serviceaccount.yaml, or none depend on the `server` framework package",
					),
				},
			],
			actions: [
				{ type: "injectSecretsServiceAccount" },
				{ type: "injectSecretsEnvConfigMap" },
				{ type: "injectOpenBaoIntoServerApp" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new SecretsGenerator(plop, serverWorkspaces);
	}
}
