import type { PlopTypes } from "@turbo/gen";
import { workspaceChoices } from "../helpers";

export default class UsecaseGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		plop.setGenerator("usecase", {
			description:
				'Generate a use case (execute() throws "Not implemented") into <server>/src/usecases, registered in its barrel',
			prompts: [
				{
					type: "list",
					name: "location",
					message: "Target server:",
					choices: workspaceChoices(
						serverWorkspaces,
						"No server workspaces found under servers/**",
					),
				},
				{
					type: "input",
					name: "name",
					message: "Use case name (PascalCase, ending in UseCase):",
					validate: (input: string) =>
						/^[A-Z][A-Za-z0-9]*UseCase$/.test(input) ||
						"Use PascalCase ending in UseCase, e.g. LogHeartbeatUseCase",
				},
			],
			actions: [
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/usecases/{{ name }}.ts",
					templateFile: "templates/usecase/UseCase.hbs",
				},
				{
					type: "appendBarrel",
					data: { folder: "usecases" },
				},
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new UsecaseGenerator(plop, serverWorkspaces);
	}
}
