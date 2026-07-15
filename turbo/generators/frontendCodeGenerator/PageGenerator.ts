import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addOrMergeNamedImport,
	appendBarrelLine,
	findFrontendModules,
	findMatchingBracket,
	frontendPlatform,
	workspaceChoices,
} from "../helpers";

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

// PascalCase (page names are validated as PascalCase ending in "Page", e.g. "Test1DetailPage")
// -> kebab-case route path, stripping the "Page" suffix: "Test1DetailPage" -> "/test1-detail".
function pageNameToRoutePath(name: string): string {
	const withoutSuffix = name.replace(/Page$/, "");
	const kebab = withoutSuffix.replace(/([A-Z])/g, (letter, _match, index) =>
		index === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`,
	);
	return `/${kebab}`;
}

// Wires a newly generated page into an existing src/router.tsx: merges an import for the page
// from its module barrel, inserts a new
// `createRoute({...})` declaration right before `const routeTree = ...`, and adds the new route
// to the `rootRoute.addChildren([...])` array. A frontend with no src/router.tsx yet (native
// platforms, or a web frontend that hasn't set one up) is left untouched — bootstrapping routing
// infrastructure from scratch is a separate concern from wiring an individual page into one that
// already exists.
function injectPageIntoRouter(location: string, module: string, name: string): string {
	const absRouterPath = path.join(process.cwd(), location, "src", "router.tsx");
	if (!fs.existsSync(absRouterPath)) {
		return `${relToRoot(absRouterPath)} not found, skipped`;
	}

	let raw = fs.readFileSync(absRouterPath, "utf-8");
	const routeVarName = `${name.charAt(0).toLowerCase()}${name.slice(1)}Route`;
	if (raw.includes(`const ${routeVarName} =`)) {
		return `${relToRoot(absRouterPath)} already has ${routeVarName}`;
	}

	raw = addOrMergeNamedImport(raw, `./modules/${module}`, name);

	const routeDecl =
		`const ${routeVarName} = createRoute({\n` +
		`\tgetParentRoute: () => rootRoute,\n` +
		`\tpath: '${pageNameToRoutePath(name)}',\n` +
		`\tcomponent: ${name},\n` +
		"});\n\n";

	const treeMarker = "const routeTree = rootRoute.addChildren([";
	const treeIndex = raw.indexOf(treeMarker);
	if (treeIndex === -1) {
		throw new Error(`Could not find "${treeMarker}" in ${absRouterPath}`);
	}
	raw = `${raw.slice(0, treeIndex)}${routeDecl}${raw.slice(treeIndex)}`;

	// Re-find the marker: the insertion above shifted every index after it.
	const newTreeIndex = raw.indexOf(treeMarker);
	const openBracketIndex = newTreeIndex + treeMarker.length - 1;
	const closeBracketIndex = findMatchingBracket(raw, openBracketIndex, "[", "]");
	const inner = raw.slice(openBracketIndex + 1, closeBracketIndex).trim();
	const newInner = inner.length > 0 ? `${inner}, ${routeVarName}` : routeVarName;
	raw = `${raw.slice(0, openBracketIndex + 1)}${newInner}${raw.slice(closeBracketIndex)}`;

	fs.writeFileSync(absRouterPath, raw);
	return `${relToRoot(absRouterPath)} (+${routeVarName})`;
}

export default class PageGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("appendPageBarrel", (answers) => {
			const { location, module, name } = answers as { location: string; module: string; name: string };
			const absBarrel = path.join(process.cwd(), location, "src", "modules", module, "pages", "index.ts");
			return appendBarrelLine(absBarrel, `export { ${name} } from './${name}';`);
		});

		plop.setActionType("injectPageIntoRouter", (answers) => {
			const { location, module, name } = answers as { location: string; module: string; name: string };
			return injectPageIntoRouter(location, module, name);
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
					// Native platforms use Expo Router (file-based) instead — no src/router.tsx to
					// wire into. A web frontend without one yet is left alone (see
					// injectPageIntoRouter's own doc comment).
					...(isNative ? [] : [{ type: "injectPageIntoRouter" }]),
				];
			},
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new PageGenerator(plop, frontendWorkspaces);
	}
}
