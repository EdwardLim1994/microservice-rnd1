import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { appendBarrelLine, findFrontendModules, workspaceChoices } from "../helpers";

interface Answers {
	location: string;
	target: "shared" | "module";
	module?: string;
	name: string;
}

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

/**
 * src/shared/components (target: "shared") or src/modules/<module>/components (target:
 * "module") — the two places a component can live, matching CLAUDE.md's module convention: things
 * scoped to one module live in that module, shareable ones live in src/shared instead.
 */
function componentsDir(root: string, answers: Answers): string {
	const base = path.join(root, answers.location, "src");
	return answers.target === "shared"
		? path.join(base, "shared", "components")
		: path.join(base, "modules", answers.module ?? "", "components");
}

/**
 * The barrel a new component gets registered in — src/shared/index.ts for a shared component (no
 * such barrel exists yet by default, created on first use, same umbrella-barrel shape as a
 * module's own index.ts) or <module>/index.ts for a module-scoped one.
 */
function barrelPath(root: string, answers: Answers): string {
	const base = path.join(root, answers.location, "src");
	return answers.target === "shared"
		? path.join(base, "shared", "index.ts")
		: path.join(base, "modules", answers.module ?? "", "index.ts");
}

function counterComponentContent(name: string): string {
	return (
		"import { useState } from 'react';\n" +
		"\n" +
		`export const ${name} = () => {\n` +
		"  const [count, setCount] = useState(0);\n" +
		"\n" +
		"  return (\n" +
		"    <div>\n" +
		"      <p>Count: {count}</p>\n" +
		'      <button type="button" onClick={() => setCount((c) => c + 1)}>\n' +
		"        Increment\n" +
		"      </button>\n" +
		"    </div>\n" +
		"  );\n" +
		"};\n"
	);
}

/**
 * Creates a component (a simple counter — useState + increment button) under either
 * src/shared/components or a module's own components folder, and registers it in the
 * corresponding barrel (src/shared/index.ts or <module>/index.ts) via a named re-export, same
 * convention as PageGenerator's pages.
 */
export default class ComponentGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("scaffoldFrontendComponent", (answers) => {
			const data = answers as Answers;
			const root = process.cwd();

			const dir = componentsDir(root, data);
			const componentPath = path.join(dir, `${data.name}.tsx`);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(componentPath, counterComponentContent(data.name));

			const barrel = barrelPath(root, data);
			const barrelResult = appendBarrelLine(
				barrel,
				`export { ${data.name} } from './components/${data.name}';`,
			);

			return `${relToRoot(componentPath)}; ${barrelResult}`;
		});

		plop.setGenerator("component", {
			description:
				"Create a component (simple counter) in src/shared/components or a module's own components folder, registered in the corresponding barrel.",
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
					name: "target",
					message: "Shared or module-specific?",
					choices: [
						{ name: "Shared (src/shared/components)", value: "shared" },
						{ name: "Module-specific (src/modules/<module>/components)", value: "module" },
					],
				},
				{
					type: "list",
					name: "module",
					message: "Target module:",
					when: (answers: Partial<Answers>) => answers.target === "module",
					choices: (answers: Partial<Answers>) =>
						workspaceChoices(
							findFrontendModules(process.cwd(), answers.location ?? ""),
							"No modules found — run `turbo gen module` first",
						),
				},
				{
					type: "input",
					name: "name",
					message: "Component name (PascalCase):",
					validate: (input: string, answers?: Partial<Answers>) => {
						if (!/^[A-Z][A-Za-z0-9]*$/.test(input)) {
							return "Use PascalCase, e.g. CounterWidget";
						}
						if (!answers?.location) return true;
						const dir = componentsDir(process.cwd(), {
							location: answers.location,
							target: answers.target ?? "shared",
							module: answers.module,
							name: input,
						});
						if (fs.existsSync(path.join(dir, `${input}.tsx`))) {
							return `${relToRoot(path.join(dir, `${input}.tsx`))} already exists`;
						}
						return true;
					},
				},
			],
			actions: [{ type: "scaffoldFrontendComponent" }],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new ComponentGenerator(plop, frontendWorkspaces);
	}
}
