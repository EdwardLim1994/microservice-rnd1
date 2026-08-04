import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { workspaceChoices } from "../helpers";

const MODULE_FOLDERS = ["pages", "components", "hooks", "viewmodels"];

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

/**
 * Scaffolds a new <location>/src/modules/<name> — pages/components/hooks/viewmodels folders plus
 * an empty index.ts barrel, matching apps/web/web1/src/modules/server1's own shape (see
 * CLAUDE.md's module convention: everything module-scoped lives here, cross-module reuse goes in
 * src/shared instead). The folders start empty (no placeholder files) — same as server1's own,
 * they only gain content once something is actually generated into them.
 */
export default class ModuleGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("scaffoldFrontendModule", (answers) => {
			const { location, name } = answers as { location: string; name: string };
			const moduleDir = path.join(process.cwd(), location, "src", "modules", name);

			for (const folder of MODULE_FOLDERS) {
				fs.mkdirSync(path.join(moduleDir, folder), { recursive: true });
			}

			const barrelPath = path.join(moduleDir, "index.ts");
			if (!fs.existsSync(barrelPath)) {
				fs.writeFileSync(barrelPath, "");
			}

			return relToRoot(moduleDir);
		});

		plop.setGenerator("module", {
			description:
				"Create a new src/modules/<name> in a web/mfe workspace — pages, components, hooks, viewmodels folders plus an empty index.ts barrel, matching apps/web/web1/src/modules/server1's shape.",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target frontend workspace:",
					choices: workspaceChoices(
						frontendWorkspaces,
						"No frontend workspaces found under apps/web/** or apps/mfe/**",
					),
				},
				{
					type: "input",
					name: "name",
					message: "New module name:",
					validate: (input: string, answers?: { location?: string }) => {
						if (!/^[a-z][a-z0-9-]*$/.test(input)) {
							return "Use lowercase letters, digits, and hyphens, starting with a letter";
						}
						const location = answers?.location;
						if (
							location &&
							fs.existsSync(path.join(process.cwd(), location, "src", "modules", input))
						) {
							return `${location}/src/modules/${input} already exists`;
						}
						return true;
					},
				},
			],
			actions: [{ type: "scaffoldFrontendModule" }],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new ModuleGenerator(plop, frontendWorkspaces);
	}
}
