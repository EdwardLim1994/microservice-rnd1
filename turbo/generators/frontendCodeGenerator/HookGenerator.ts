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
 * src/shared/hooks (target: "shared") or src/modules/<module>/hooks (target: "module") — the two
 * places a hook can live, matching CLAUDE.md's module convention: things scoped to one module
 * live in that module, shareable ones live in src/shared instead.
 */
function hooksDir(root: string, answers: Answers): string {
	const base = path.join(root, answers.location, "src");
	return answers.target === "shared"
		? path.join(base, "shared", "hooks")
		: path.join(base, "modules", answers.module ?? "", "hooks");
}

/**
 * The barrel a new hook gets registered in — src/shared/index.ts for a shared hook (created on
 * first use if it doesn't exist yet) or <module>/index.ts for a module-scoped one.
 */
function barrelPath(root: string, answers: Answers): string {
	const base = path.join(root, answers.location, "src");
	return answers.target === "shared"
		? path.join(base, "shared", "index.ts")
		: path.join(base, "modules", answers.module ?? "", "index.ts");
}

function hookContent(name: string): string {
	return `export const ${name} = () => {\n  return {};\n};\n`;
}

/**
 * Creates a hook (stub — returns an empty object) under either src/shared/hooks or a module's own
 * hooks folder, and registers it in the corresponding barrel (src/shared/index.ts or
 * <module>/index.ts) via a named re-export, same convention as PageGenerator/ComponentGenerator.
 */
export default class HookGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("scaffoldFrontendHook", (answers) => {
			const data = answers as Answers;
			const root = process.cwd();

			const dir = hooksDir(root, data);
			const hookPath = path.join(dir, `${data.name}.ts`);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(hookPath, hookContent(data.name));

			const barrel = barrelPath(root, data);
			const barrelResult = appendBarrelLine(barrel, `export { ${data.name} } from './hooks/${data.name}';`);

			return `${relToRoot(hookPath)}; ${barrelResult}`;
		});

		plop.setGenerator("hook", {
			description:
				"Create a hook (stub — returns an empty object) in src/shared/hooks or a module's own hooks folder, registered in the corresponding barrel.",
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
						{ name: "Shared (src/shared/hooks)", value: "shared" },
						{ name: "Module-specific (src/modules/<module>/hooks)", value: "module" },
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
					message: "Hook name (camelCase, starting with use):",
					validate: (input: string, answers?: Partial<Answers>) => {
						if (!/^use[A-Z][A-Za-z0-9]*$/.test(input)) {
							return "Use camelCase starting with 'use', e.g. useCounter";
						}
						if (!answers?.location) return true;
						const dir = hooksDir(process.cwd(), {
							location: answers.location,
							target: answers.target ?? "shared",
							module: answers.module,
							name: input,
						});
						if (fs.existsSync(path.join(dir, `${input}.ts`))) {
							return `${relToRoot(path.join(dir, `${input}.ts`))} already exists`;
						}
						return true;
					},
				},
			],
			actions: [{ type: "scaffoldFrontendHook" }],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new HookGenerator(plop, frontendWorkspaces);
	}
}
