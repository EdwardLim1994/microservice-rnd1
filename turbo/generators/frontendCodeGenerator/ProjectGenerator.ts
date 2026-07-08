import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	appendRootComposeInclude,
	copyWithSubstitutions,
	DEFAULT_FRONTEND_PORT,
	findAvailableFrontendPort,
} from "../helpers";

const FAVICON_SOURCE_PATH = path.join(
	process.cwd(),
	"turbo",
	"generators",
	"templates",
	"frontend-project-static",
	"favicon.png",
);

// Shared by all three project roles (host/remote/plain) — their Dockerfiles are identical in
// runtime shape (single port, `bun run preview`, oven/bun runtime — see
// frontends/frontend1/terraform/CLAUDE.md), so one generic Helm chart/Terraform module covers
// all of them, parameterized by name/port/location the same way templates/server's does by name.
const DEPLOY_TEMPLATES_DIR = path.join(
	process.cwd(),
	"turbo",
	"generators",
	"templates",
	"frontend-deploy",
);

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

type ProjectType = "regular" | "microfrontend";

// For a microfrontend, role is inferred from location, matching the two real projects already
// in this repo: apps/portal (a host — consumes remotes, no exposes/Apollo) and
// frontends/frontend1 (a remote — exposes ./App, has its own Apollo Client). A "regular" app
// skips Module Federation entirely regardless of location, hence the third "plain" template set.
function templateRole(type: ProjectType, location: string): "host" | "remote" | "plain" {
	if (type === "regular") return "plain";
	return location === "apps" ? "host" : "remote";
}

export default class ProjectGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		// Runs before the "addMany" action below and mutates `answers` in place — node-plop
		// threads the same answers object through every action in a run, so fields added here
		// (port, envVarName, mfName) are visible to addMany's own Handlebars rendering, exactly
		// like the prompt-answered fields (location, type, name) are. Only the "remote" template
		// actually references envVarName (for its assetPrefix's <NAME>_HOST env var) — host/plain
		// just ignore it.
		plop.setActionType("computeFrontendProjectData", (answers) => {
			const { location, type, name } = answers as { location: string; type: ProjectType; name: string };
			const port = findAvailableFrontendPort(process.cwd());
			const envVarName = name.toUpperCase().replaceAll("-", "_");
			// Module Federation's `name` becomes a JS variable name in the built bundle (the var
			// declaring library type) — a kebab-case project name (valid everywhere else, and what
			// the "name" prompt's own validate allows) isn't a valid JS identifier and breaks the
			// build with "Library name base (...) must be a valid identifier". host/remote's
			// rsbuild.config.ts use this instead of the raw name; "plain" doesn't use MF at all.
			const mfName = name.replaceAll("-", "_");
			const role = templateRole(type, location);
			Object.assign(answers as Record<string, unknown>, { port, envVarName, mfName });
			const envNote = role === "remote" ? ` (env var ${envVarName}_HOST)` : "";
			return `Assigned port ${port}, template "${role}"${envNote}`;
		});

		// public/favicon.png is a binary PNG — plop's "add"/"addMany" actions read+write template
		// files as UTF-8 text through Handlebars, which would corrupt it, so it's copied directly
		// instead of living inside templates/frontend-project/.
		plop.setActionType("copyFrontendFavicon", (answers) => {
			const { location, name } = answers as { location: string; name: string };
			const destDir = path.join(process.cwd(), location, name, "public");
			fs.mkdirSync(destDir, { recursive: true });
			const destPath = path.join(destDir, "favicon.png");
			fs.copyFileSync(FAVICON_SOURCE_PATH, destPath);
			return relToRoot(destPath);
		});

		// Copies the shared helm/terraform deploy scaffolding — see DEPLOY_TEMPLATES_DIR's comment
		// for why one template covers all three roles. Runs after computeFrontendProjectData,
		// which put `port` on `answers`.
		plop.setActionType("copyFrontendDeployConfig", (answers) => {
			const { location, name, port } = answers as { location: string; name: string; port: number };
			const destRoot = path.join(process.cwd(), location, name);
			// See helm/values.yaml's own comment for why NodePort, not ClusterIP, and why this
			// particular offset — kept collision-free by construction, since it's derived from
			// the already-collision-checked dev port (findAvailableFrontendPort).
			const nodePort = 30000 + (port - DEFAULT_FRONTEND_PORT);
			for (const dir of ["helm", "terraform"]) {
				copyWithSubstitutions(path.join(DEPLOY_TEMPLATES_DIR, dir), path.join(destRoot, dir), {
					name,
					port: String(port),
					nodePort: String(nodePort),
					location,
				});
			}
			return `${location}/${name}/{helm,terraform} (NodePort ${nodePort})`;
		});

		// Registers the new project's docker-compose.yml in the root docker-compose.yml's
		// `include:` list, so `docker compose up` from repo root actually brings it up. Named
		// distinctly from ServerGenerator's equivalent — plop.setActionType is a single global
		// registry keyed by name, not scoped per generator, so a same-named registration there
		// would silently overwrite this one (or vice versa, depending on apply() order).
		plop.setActionType("appendFrontendComposeInclude", (answers) => {
			const { location, name } = answers as { location: string; name: string };
			return appendRootComposeInclude(process.cwd(), location, name);
		});

		plop.setGenerator("web", {
			description:
				"Create a new React web app under apps/<name> or frontends/<name>, either a regular standalone app or a Module Federation microfrontend (role — host vs remote — inferred from location: apps/ scaffolds a host modeled on portal, frontends/ scaffolds a remote modeled on frontend1). Includes a Dockerfile + docker-compose.yml (registered into the root docker-compose.yml's include: list). No src/modules either way — add those with the 'module' generator",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Where should this project live?",
					choices: [
						{ name: "frontends/", value: "frontends" },
						{ name: "apps/", value: "apps" },
					],
				},
				{
					type: "list",
					name: "type",
					message: "Project type:",
					choices: [
						{ name: "Regular React app (no Module Federation)", value: "regular" },
						{
							name: "Microfrontend (Module Federation — host if apps/, remote if frontends/)",
							value: "microfrontend",
						},
					],
				},
				{
					type: "input",
					name: "name",
					message: "New frontend project name:",
					validate: (input: string, answers?: { location: string }) => {
						if (!/^[a-z][a-z0-9-]*$/.test(input)) {
							return "Use lowercase letters, digits, and hyphens, starting with a letter";
						}
						const location = answers?.location ?? "frontends";
						if (fs.existsSync(path.join(process.cwd(), location, input))) {
							return `${location}/${input} already exists`;
						}
						return true;
					},
				},
			],
			actions: (answers) => {
				const { location, type } = answers as { location: string; type: ProjectType };
				const role = templateRole(type, location);
				const templateDir = `templates/frontend-project-${role}`;
				return [
					{ type: "computeFrontendProjectData" },
					{
						type: "addMany",
						destination: "{{ turbo.paths.root }}/{{ location }}/{{ name }}",
						base: templateDir,
						templateFiles: `${templateDir}/**/*`,
						globOptions: { dot: true },
					},
					{ type: "copyFrontendFavicon" },
					{ type: "copyFrontendDeployConfig" },
					{ type: "appendFrontendComposeInclude" },
				];
			},
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ProjectGenerator(plop);
	}
}
