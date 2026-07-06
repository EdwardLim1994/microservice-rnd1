import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { workspaceChoices } from "../helpers";

export default class ModuleGenerator {
	private constructor(
		plop: PlopTypes.NodePlopAPI,
		frontendWorkspaces: string[],
	) {
		plop.setGenerator("module", {
			description:
				"Create a new module (pages/viewmodel/types barrels) under <frontend>/src/modules, following frontend1's demo1 module shape",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target frontend:",
					choices: workspaceChoices(
						frontendWorkspaces,
						"No frontend workspaces found under apps/** or frontends/**",
					),
				},
				{
					type: "input",
					name: "name",
					message: "Module name (lowercase, e.g. demo2):",
					validate: (input: string, answers?: { location: string }) => {
						if (!/^[a-z][a-z0-9-]*$/.test(input)) {
							return "Use lowercase letters, digits, and hyphens, starting with a letter";
						}
						if (
							answers?.location &&
							fs.existsSync(
								path.join(
									process.cwd(),
									answers.location,
									"src",
									"modules",
									input,
								),
							)
						) {
							return `${answers.location}/src/modules/${input} already exists`;
						}
						return true;
					},
				},
			],
			actions: [
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/modules/{{ name }}/index.ts",
					templateFile: "templates/frontend/module/index.ts.hbs",
				},
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/modules/{{ name }}/pages/index.ts",
					templateFile: "templates/frontend/module/pages-index.ts.hbs",
				},
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/modules/{{ name }}/viewmodel/index.ts",
					templateFile: "templates/frontend/module/viewmodel-index.ts.hbs",
				},
			],
		});
	}

	public static apply(
		plop: PlopTypes.NodePlopAPI,
		frontendWorkspaces: string[],
	) {
		return new ModuleGenerator(plop, frontendWorkspaces);
	}
}
