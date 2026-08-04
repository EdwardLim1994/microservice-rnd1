import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	appendRootTiltfileInclude,
	findAvailableFrontendPort,
	findFrontendWorkspaces,
} from "../helpers";
import ComponentGenerator from "./ComponentGenerator";
import HookGenerator from "./HookGenerator";
import ModuleGenerator from "./ModuleGenerator";
import PageGenerator from "./PageGenerator";
import UsecaseGenerator from "./UsecaseGenerator";

type Role = "host" | "remote";

interface Answers {
	name: string;
	isMicrofrontend: boolean;
	role?: Role;
}

interface TemplateData {
	name: string;
	isMicrofrontend: boolean;
	isHost: boolean;
	location: string;
	parentDir: string;
	namespace: string;
	label: string;
	port: number;
}

const WEB_TEMPLATE_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "web");
const BOOTSTRAP_TEMPLATE_PATH = path.join(
	process.cwd(),
	"turbo",
	"generators",
	"templates",
	"web-extra",
	"bootstrap.tsx",
);

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

function buildTemplateData(answers: Answers): TemplateData {
	const { name, role } = answers;
	const isMicrofrontend = Boolean(answers.isMicrofrontend);
	const isHost = isMicrofrontend && role !== "remote";
	const parentDir = role === "remote" ? "apps/mfe" : "apps/web";
	return {
		name,
		isMicrofrontend,
		isHost,
		parentDir,
		location: `${parentDir}/${name}`,
		namespace: "apps",
		label: role === "remote" ? "mfe" : "web",
		port: findAvailableFrontendPort(process.cwd()),
	};
}

/**
 * Recursively renders every file under templates/web into <root>/<location>, preserving the
 * directory structure — templates/web has no per-variant subfolders (plain/host/remote share one
 * tree; the differences are Handlebars conditionals inside package.json/rsbuild.config.ts/
 * src/index.tsx keyed on `isMicrofrontend`/`isHost`), so a single recursive copy covers all three
 * project kinds.
 */
function copyTemplateDir(
	srcDir: string,
	destDir: string,
	data: TemplateData,
	plopApi: { renderString: (template: string, data: unknown) => string },
): string[] {
	const written: string[] = [];
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const srcPath = path.join(srcDir, entry.name);
		const destPath = path.join(destDir, entry.name);
		if (entry.isDirectory()) {
			written.push(...copyTemplateDir(srcPath, destPath, data, plopApi));
			continue;
		}
		fs.mkdirSync(destDir, { recursive: true });
		const rendered = plopApi.renderString(fs.readFileSync(srcPath, "utf-8"), data);
		fs.writeFileSync(destPath, rendered);
		written.push(relToRoot(destPath));
	}
	return written;
}

/**
 * A "web" (Rsbuild) generated project isn't a microfrontend at all, a Module Federation host
 * (consumes remotes, always under apps/web/), or a Module Federation remote (exposes itself to a
 * host, always under apps/mfe/) — see CLAUDE.md's "Tilt + Helm" section for why apps/web and
 * apps/mfe are the fixed targets rather than an asked-for location.
 */
export default class FrontendCodeGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		plop.setActionType("scaffoldFrontendProject", (answers, _config, plopApi) => {
			const data = buildTemplateData(answers as Answers);
			const destDir = path.join(process.cwd(), data.location);
			const written = copyTemplateDir(WEB_TEMPLATE_DIR, destDir, data, plopApi);

			if (data.isMicrofrontend) {
				const rendered = plopApi.renderString(
					fs.readFileSync(BOOTSTRAP_TEMPLATE_PATH, "utf-8"),
					data,
				);
				const bootstrapPath = path.join(destDir, "src", "bootstrap.tsx");
				fs.writeFileSync(bootstrapPath, rendered);
				written.push(relToRoot(bootstrapPath));
			}

			return `${data.location} (${written.length} files)`;
		});

		plop.setActionType("appendFrontendTiltfileInclude", (answers) => {
			const { parentDir, name } = buildTemplateData(answers as Answers);
			return appendRootTiltfileInclude(process.cwd(), parentDir, name);
		});

		plop.setGenerator("web", {
			description:
				"Create a new Rsbuild React project: a plain web app, a Module Federation host, or a Module Federation remote. Hosts and plain apps always land in apps/web/<name>, remotes always in apps/mfe/<name>.",
			prompts: [
				{
					type: "input",
					name: "name",
					message: "New project name:",
					validate: (input: string) => {
						if (!/^[a-z][a-z0-9-]*$/.test(input)) {
							return "Use lowercase letters, digits, and hyphens, starting with a letter";
						}
						if (fs.existsSync(path.join(process.cwd(), "apps", "web", input))) {
							return `apps/web/${input} already exists`;
						}
						if (fs.existsSync(path.join(process.cwd(), "apps", "mfe", input))) {
							return `apps/mfe/${input} already exists`;
						}
						return true;
					},
				},
				{
					type: "confirm",
					name: "isMicrofrontend",
					message: "Generate this as a microfrontend project?",
					default: false,
				},
				{
					type: "list",
					name: "role",
					message: "Is it a host or a remote?",
					choices: [
						{ name: "Host (consumes remotes, apps/web/)", value: "host" },
						{ name: "Remote (exposed to a host, apps/mfe/)", value: "remote" },
					],
					when: (answers: Partial<Answers>) => Boolean(answers.isMicrofrontend),
				},
			],
			actions: [{ type: "scaffoldFrontendProject" }, { type: "appendFrontendTiltfileInclude" }],
		});

		ModuleGenerator.apply(plop, findFrontendWorkspaces(process.cwd()));
		PageGenerator.apply(plop, findFrontendWorkspaces(process.cwd()));
		ComponentGenerator.apply(plop, findFrontendWorkspaces(process.cwd()));
		HookGenerator.apply(plop, findFrontendWorkspaces(process.cwd()));
		UsecaseGenerator.apply(plop, findFrontendWorkspaces(process.cwd()));
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new FrontendCodeGenerator(plop);
	}
}
