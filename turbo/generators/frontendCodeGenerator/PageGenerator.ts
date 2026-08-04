import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import {
	addOrMergeNamedImport,
	appendBarrelLine,
	findFrontendModules,
	findMatchingBracket,
	workspaceChoices,
} from "../helpers";

interface Answers {
	location: string;
	module: string;
	urlPath: string;
	pageName: string;
}

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

/**
 * "/about/team" -> ["about", "team"]; "/" or "" -> [] (the root page).
 */
function urlSegments(urlPath: string): string[] {
	return urlPath.split("/").filter(Boolean);
}

/**
 * Where a URL path's thin wrapper lands under <location>/src/pages — every segment but the last
 * becomes a directory, the last segment becomes the file itself (Next.js pages-router shape:
 * "/about/team" -> src/pages/about/team.tsx; "/" -> src/pages/index.tsx).
 */
function wrapperPagePath(root: string, location: string, urlPath: string): string {
	const segments = urlSegments(urlPath);
	const dirSegments = segments.slice(0, -1);
	const fileName = segments.length > 0 ? segments[segments.length - 1] : "index";
	return path.join(root, location, "src", "pages", ...dirSegments, `${fileName}.tsx`);
}

function modulePageImplPath(root: string, location: string, moduleName: string, pageName: string): string {
	return path.join(root, location, "src", "modules", moduleName, "pages", `${pageName}.tsx`);
}

/**
 * A relative import specifier from `fromDir` to `toFileNoExt` (an absolute path with no
 * extension), always starting with "./" or "../" — path.relative alone omits the leading "./"
 * for a same-or-descendant target, which isn't a valid module specifier.
 */
function relImportPath(fromDir: string, toFileNoExt: string): string {
	const rel = path.relative(fromDir, toFileNoExt).split(path.sep).join("/");
	return rel.startsWith(".") ? rel : `./${rel}`;
}

/**
 * The wrapper only re-exports the real component — its whole job is mapping a URL path onto a
 * file location; the actual UI lives in the module (see pageComponentContent below).
 */
function wrapperContent(pageName: string, wrapperDir: string, implPath: string): string {
	const relImport = relImportPath(wrapperDir, implPath.replace(/\.tsx$/, ""));
	return `export { ${pageName} } from '${relImport}';\n`;
}

/**
 * Reconstructs a canonical, TanStack-Router-ready path from whatever the user typed (leading/
 * trailing slashes optional) — "/" for the root page, "/about/team" otherwise.
 */
function canonicalUrlPath(urlPath: string): string {
	const segments = urlSegments(urlPath);
	return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

/**
 * "TeamRosterPage" -> "teamRosterRoute". Collides with the router's own "rootRoute" identifier
 * when pageName is literally "RootPage" — injectRouteIntoRouter guards against that explicitly
 * rather than silently emitting a duplicate `const rootRoute =`.
 */
function routeVariableName(pageName: string): string {
	const base = pageName.replace(/Page$/, "");
	return `${base.charAt(0).toLowerCase()}${base.slice(1)}Route`;
}

/**
 * True if src/router.tsx exists for this location and already declares a `const <identifier> =`
 * matching this pageName's derived route variable — checked at prompt time (before any file is
 * written) so a colliding name fails fast instead of leaving orphaned module/wrapper/barrel files
 * behind when injectRouteIntoRouter later throws.
 */
function routerHasIdentifierCollision(root: string, location: string, pageName: string): boolean {
	const routerPath = path.join(root, location, "src", "router.tsx");
	if (!fs.existsSync(routerPath)) return false;
	const raw = fs.readFileSync(routerPath, "utf-8");
	return raw.includes(`const ${routeVariableName(pageName)} =`);
}

/**
 * Splices a new route into src/router.tsx: imports the wrapper page's component, declares a
 * `createRoute({...})` for it right before `export const routeTree = ...`, and adds it to
 * rootRoute's addChildren([...]) array. Routes to the wrapper under src/pages (not the module's
 * own component directly) — the wrapper is the thing this URL path actually maps to.
 */
function injectRouteIntoRouter(
	routerPath: string,
	urlPath: string,
	pageName: string,
	wrapperImportPath: string,
): string {
	if (!fs.existsSync(routerPath)) {
		return `${relToRoot(routerPath)} not found, skipped`;
	}

	let raw = fs.readFileSync(routerPath, "utf-8");
	const path_ = canonicalUrlPath(urlPath);
	const routeName = routeVariableName(pageName);

	if (raw.includes(`path: '${path_}'`)) {
		return `${relToRoot(routerPath)} already has a route for ${path_}`;
	}
	if (raw.includes(`const ${routeName} =`)) {
		throw new Error(
			`${relToRoot(routerPath)} already declares "${routeName}" — rename the page (e.g. not "RootPage") to avoid a naming collision`,
		);
	}

	raw = addOrMergeNamedImport(raw, wrapperImportPath, pageName);

	const treeMarker = "export const routeTree = rootRoute.addChildren([";
	const markerIndex = raw.indexOf(treeMarker);
	if (markerIndex === -1) {
		throw new Error(`Could not find "${treeMarker}" in ${routerPath}`);
	}

	const routeDef =
		`const ${routeName} = createRoute({\n` +
		"  getParentRoute: () => rootRoute,\n" +
		`  path: '${path_}',\n` +
		`  component: ${pageName},\n` +
		"});\n\n";
	raw = `${raw.slice(0, markerIndex)}${routeDef}${raw.slice(markerIndex)}`;

	const openBracketIndex = raw.indexOf("[", raw.indexOf(treeMarker));
	const closeBracketIndex = findMatchingBracket(raw, openBracketIndex, "[", "]");
	const inner = raw.slice(openBracketIndex + 1, closeBracketIndex).trimEnd();
	const separator = inner.trim() === "" || inner.trim().endsWith(",") ? "" : ",";
	raw = `${raw.slice(0, openBracketIndex + 1)}${inner}${separator} ${routeName}${raw.slice(closeBracketIndex)}`;

	fs.writeFileSync(routerPath, raw);
	return `${relToRoot(routerPath)} (+${routeName})`;
}

function pageComponentContent(pageName: string): string {
	return (
		`export const ${pageName} = () => {\n` +
		"  return (\n" +
		"    <div>\n" +
		`      <h1>${pageName}</h1>\n` +
		"    </div>\n" +
		"  );\n" +
		"};\n"
	);
}

/**
 * Creates the real page component in <location>/src/modules/<module>/pages, registers it in that
 * module's own barrel (<location>/src/modules/<module>/index.ts — see appendBarrelLine's own doc
 * comment for why pages use a named re-export rather than a wildcard one), drops a thin wrapper
 * under <location>/src/pages mapping the given URL path to that component, and — if the workspace
 * has one — wires that wrapper into src/router.tsx as a new route (see injectRouteIntoRouter).
 */
export default class PageGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("scaffoldFrontendPage", (answers) => {
			const { location, module: moduleName, urlPath, pageName } = answers as Answers;
			const root = process.cwd();

			const implPath = modulePageImplPath(root, location, moduleName, pageName);
			fs.mkdirSync(path.dirname(implPath), { recursive: true });
			fs.writeFileSync(implPath, pageComponentContent(pageName));

			const barrelPath = path.join(root, location, "src", "modules", moduleName, "index.ts");
			const barrelResult = appendBarrelLine(
				barrelPath,
				`export { ${pageName} } from './pages/${pageName}';`,
			);

			const wrapperPath = wrapperPagePath(root, location, urlPath);
			fs.mkdirSync(path.dirname(wrapperPath), { recursive: true });
			fs.writeFileSync(wrapperPath, wrapperContent(pageName, path.dirname(wrapperPath), implPath));

			const routerPath = path.join(root, location, "src", "router.tsx");
			const wrapperImportPath = relImportPath(
				path.dirname(routerPath),
				wrapperPath.replace(/\.tsx$/, ""),
			);
			const routerResult = injectRouteIntoRouter(routerPath, urlPath, pageName, wrapperImportPath);

			return `${relToRoot(implPath)}; ${relToRoot(wrapperPath)}; ${barrelResult}; ${routerResult}`;
		});

		plop.setGenerator("page", {
			description:
				"Create a page: the real component in <module>/pages (registered in that module's barrel), a thin wrapper under src/pages mapping a URL path to it, and a route for that wrapper in src/router.tsx.",
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
					type: "list",
					name: "module",
					message: "Target module:",
					choices: (answers: Partial<Answers>) =>
						workspaceChoices(
							findFrontendModules(process.cwd(), answers.location ?? ""),
							"No modules found — run `turbo gen module` first",
						),
				},
				{
					type: "input",
					name: "urlPath",
					message: "URL path (e.g. /about/team, or / for the root page):",
					validate: (input: string, answers?: Partial<Answers>) => {
						const trimmed = input.trim();
						if (trimmed !== "/" && !/^\/?([a-z0-9-]+\/)*[a-z0-9-]+\/?$/.test(trimmed)) {
							return "Use lowercase letters, digits, and hyphens per segment, e.g. /about/team";
						}
						const location = answers?.location;
						if (location && fs.existsSync(wrapperPagePath(process.cwd(), location, trimmed))) {
							return `A wrapper page already exists for ${trimmed}`;
						}
						return true;
					},
				},
				{
					type: "input",
					name: "pageName",
					message: "Page component name (PascalCase, ending in Page):",
					validate: (input: string, answers?: Partial<Answers>) => {
						if (!/^[A-Z][A-Za-z0-9]*Page$/.test(input)) {
							return "Use PascalCase ending in Page, e.g. TeamPage";
						}
						const { location, module: moduleName } = answers ?? {};
						if (
							location &&
							moduleName &&
							fs.existsSync(modulePageImplPath(process.cwd(), location, moduleName, input))
						) {
							return `${moduleName}/pages/${input}.tsx already exists`;
						}
						if (location && routerHasIdentifierCollision(process.cwd(), location, input)) {
							return `router.tsx already declares "${routeVariableName(input)}" — pick a different page name (e.g. not "RootPage")`;
						}
						return true;
					},
				},
			],
			actions: [{ type: "scaffoldFrontendPage" }],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new PageGenerator(plop, frontendWorkspaces);
	}
}
