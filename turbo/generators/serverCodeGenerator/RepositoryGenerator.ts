import type { PlopTypes } from "@turbo/gen";
import { workspaceChoices } from "../helpers";

export default class RepositoryGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, prismaServerWorkspaces: string[]) {
		plop.setGenerator("repository", {
			description:
				"Generate a repository (constructor only) into <server>/src/repositories, registered in its barrel",
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						prismaServerWorkspaces,
						"No server workspaces with a Prisma schema found under servers/**",
					),
				},
				{
					type: "input",
					name: "name",
					message: "Repository name (PascalCase, ending in Repository):",
					validate: (input: string) =>
						/^[A-Z][A-Za-z0-9]*Repository$/.test(input) ||
						"Use PascalCase ending in Repository, e.g. DemoRepository",
				},
			],
			actions: [
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/repositories/{{ name }}.ts",
					templateFile: "templates/repository/Repository.hbs",
				},
				{
					type: "appendBarrel",
					data: { folder: "repositories" },
				},
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, prismaServerWorkspaces: string[]) {
		return new RepositoryGenerator(plop, prismaServerWorkspaces);
	}
}
