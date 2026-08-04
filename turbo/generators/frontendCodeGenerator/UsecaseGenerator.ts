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
 * src/shared/usecases (target: "shared") or src/modules/<module>/usecases (target: "module") —
 * business logic called from hooks (see the backend's own BaseUseCase for the analogous
 * server-side concept), functional here rather than class-based: no DI container exists on the
 * frontend to justify constructor injection, so a plain async function is the simpler match.
 */
function usecasesDir(root: string, answers: Answers): string {
	const base = path.join(root, answers.location, "src");
	return answers.target === "shared"
		? path.join(base, "shared", "usecases")
		: path.join(base, "modules", answers.module ?? "", "usecases");
}

/**
 * The barrel a new usecase gets registered in — src/shared/index.ts for a shared usecase
 * (created on first use if it doesn't exist yet) or <module>/index.ts for a module-scoped one.
 */
function barrelPath(root: string, answers: Answers): string {
	const base = path.join(root, answers.location, "src");
	return answers.target === "shared"
		? path.join(base, "shared", "index.ts")
		: path.join(base, "modules", answers.module ?? "", "index.ts");
}

function usecaseContent(name: string): string {
	return `export async function ${name}(): Promise<void> {\n  throw new Error('Not implemented');\n}\n`;
}

/**
 * Creates a usecase (stub — execute() throws "Not implemented", mirroring the backend's
 * BaseUseCase convention but as a plain async function) under either src/shared/usecases or a
 * module's own usecases folder, and registers it in the corresponding barrel via a named
 * re-export, same convention as PageGenerator/ComponentGenerator/HookGenerator.
 */
export default class UsecaseGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		plop.setActionType("scaffoldFrontendUsecase", (answers) => {
			const data = answers as Answers;
			const root = process.cwd();

			const dir = usecasesDir(root, data);
			const usecasePath = path.join(dir, `${data.name}.ts`);
			fs.mkdirSync(dir, { recursive: true });
			fs.writeFileSync(usecasePath, usecaseContent(data.name));

			const barrel = barrelPath(root, data);
			const barrelResult = appendBarrelLine(
				barrel,
				`export { ${data.name} } from './usecases/${data.name}';`,
			);

			return `${relToRoot(usecasePath)}; ${barrelResult}`;
		});

		// Named "web-usecase", not "usecase" — plop.setGenerator is a single global registry keyed
		// by name, and ServerCodeGenerator's UsecaseGenerator already registered "usecase" for the
		// backend; reusing that name here would silently clobber it.
		plop.setGenerator("web-usecase", {
			description:
				'Create a usecase (execute() throws "Not implemented", functional style) in src/shared/usecases or a module\'s own usecases folder, registered in the corresponding barrel.',
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
						{ name: "Shared (src/shared/usecases)", value: "shared" },
						{ name: "Module-specific (src/modules/<module>/usecases)", value: "module" },
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
					message: "Usecase name (PascalCase, ending in UseCase):",
					validate: (input: string, answers?: Partial<Answers>) => {
						if (!/^[A-Z][A-Za-z0-9]*UseCase$/.test(input)) {
							return "Use PascalCase ending in UseCase, e.g. GetItemUseCase";
						}
						if (!answers?.location) return true;
						const dir = usecasesDir(process.cwd(), {
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
			actions: [{ type: "scaffoldFrontendUsecase" }],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, frontendWorkspaces: string[]) {
		return new UsecaseGenerator(plop, frontendWorkspaces);
	}
}
