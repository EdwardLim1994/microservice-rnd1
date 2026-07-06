import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { appendBarrelLine, findFrontendModules, frontendPlatform, workspaceChoices } from "../helpers";

export default class PageGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("appendPageBarrel", (answers) => {
			const { location, module, name } = answers as { location: string; module: string; name: string };
			const absBarrel = path.join(process.cwd(), location, "src", "modules", module, "pages", "index.ts");
			return appendBarrelLine(absBarrel, `export { ${name} } from './${name}';`);
		});

		plop.setGenerator("page", {
			description:
				"Generate a page component (stub) into an existing module's pages/, registered in its barrel — HTML (matching frontend1's Demo1Page) for a web frontend, React Native primitives for a mobile app, detected from the chosen location",
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
					// Function, not a static array — filters per chosen `location`. Only works for
					// interactive selection (`turbo gen ... --args` chokes on function-typed
					// choices), which is fine since that's the documented entry point.
					choices: (answers: { location: string }) =>
						workspaceChoices(
							findFrontendModules(process.cwd(), answers.location),
							`No modules found under ${answers.location}/src/modules — run the "module" generator first`,
						),
				},
				{
					type: "input",
					name: "name",
					message: "Page name (PascalCase, ending in Page):",
					validate: (input: string) =>
						/^[A-Z][A-Za-z0-9]*Page$/.test(input) || "Use PascalCase ending in Page, e.g. Demo2Page",
				},
			],
			actions: (answers) => {
				const { location } = answers as { location: string };
				const isNative = frontendPlatform(process.cwd(), location) === "native";
				const templateFile = isNative
					? "templates/frontend/page/Page.native.tsx.hbs"
					: "templates/frontend/page/Page.tsx.hbs";
				return [
					{
						type: "add",
						path: "{{ turbo.paths.root }}/{{ location }}/src/modules/{{ module }}/pages/{{ name }}.tsx",
						templateFile,
					},
					{ type: "appendPageBarrel" },
				];
			},
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new PageGenerator(plop, frontendWorkspaces);
	}
}
