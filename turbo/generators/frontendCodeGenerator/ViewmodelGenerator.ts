import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { appendBarrelLine, findFrontendModules, workspaceChoices } from "../helpers";

export default class ViewmodelGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("appendViewmodelBarrel", (answers) => {
			const { location, module, name } = answers as { location: string; module: string; name: string };
			const absBarrel = path.join(
				process.cwd(),
				location,
				"src",
				"modules",
				module,
				"viewmodel",
				"index.ts",
			);
			return appendBarrelLine(absBarrel, `export * from './${name}';`);
		});

		plop.setGenerator("viewmodel", {
			description:
				"Generate a viewmodel hook (stub, matching frontend1's useDemo1) into an existing module's viewmodel/, registered in its barrel",
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
					type: "list",
					name: "module",
					message: "Target module:",
					choices: (answers: { location: string }) =>
						workspaceChoices(
							findFrontendModules(process.cwd(), answers.location),
							`No modules found under ${answers.location}/src/modules — run the "module" generator first`,
						),
				},
				{
					type: "input",
					name: "name",
					message: "Viewmodel hook name (camelCase, starting with 'use'):",
					validate: (input: string) =>
						/^use[A-Z][A-Za-z0-9]*$/.test(input) || "Use camelCase starting with 'use', e.g. useDemo2",
				},
			],
			actions: [
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/modules/{{ module }}/viewmodel/{{ name }}.ts",
					templateFile: "templates/frontend/viewmodel/Viewmodel.ts.hbs",
				},
				{ type: "appendViewmodelBarrel" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new ViewmodelGenerator(plop, frontendWorkspaces);
	}
}
