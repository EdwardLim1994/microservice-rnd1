import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { appendBarrelLine, findFrontendModules, frontendPlatform, workspaceChoices } from "../helpers";

export default class ComponentGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("appendComponentBarrel", (answers) => {
			const { location, module, name } = answers as { location: string; module: string; name: string };
			const absBarrel = path.join(
				process.cwd(),
				location,
				"src",
				"modules",
				module,
				"components",
				"index.ts",
			);
			return appendBarrelLine(absBarrel, `export { ${name} } from './${name}';`);
		});

		// Unlike pages/viewmodel/types, ModuleGenerator doesn't scaffold a components/ folder by
		// default (no existing module in the repo has one yet) — the first component added to a
		// module also has to wire "./components" into that module's own root barrel.
		plop.setActionType("ensureModuleExportsComponents", (answers) => {
			const { location, module } = answers as { location: string; module: string };
			const absModuleIndex = path.join(process.cwd(), location, "src", "modules", module, "index.ts");
			return appendBarrelLine(absModuleIndex, "export * from './components';");
		});

		plop.setGenerator("component", {
			description:
				"Generate a reusable UI component (stub) into an existing module's components/, registered in its barrel and the module's root barrel — HTML for a web frontend, React Native primitives for a mobile app, detected from the chosen location",
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
					message: "Component name (PascalCase):",
					validate: (input: string) =>
						/^[A-Z][A-Za-z0-9]*$/.test(input) || "Use PascalCase, e.g. Demo2Card",
				},
			],
			actions: (answers) => {
				const { location } = answers as { location: string };
				const isNative = frontendPlatform(process.cwd(), location) === "native";
				const templateFile = isNative
					? "templates/frontend/component/Component.native.tsx.hbs"
					: "templates/frontend/component/Component.tsx.hbs";
				return [
					{
						type: "add",
						path: "{{ turbo.paths.root }}/{{ location }}/src/modules/{{ module }}/components/{{ name }}.tsx",
						templateFile,
					},
					{ type: "appendComponentBarrel" },
					{ type: "ensureModuleExportsComponents" },
				];
			},
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new ComponentGenerator(plop, frontendWorkspaces);
	}
}
