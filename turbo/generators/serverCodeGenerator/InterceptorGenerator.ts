import type { PlopTypes } from "@turbo/gen";
import { workspaceChoices } from "../helpers";

export default class InterceptorGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		plop.setGenerator("interceptor", {
			description:
				'Generate an interceptor (intercept() throws "Not implemented") into <server>/src/interceptors, registered in its barrel',
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
					message: "Interceptor name (PascalCase, ending in Interceptor):",
					validate: (input: string) =>
						/^[A-Z][A-Za-z0-9]*Interceptor$/.test(input) ||
						"Use PascalCase ending in Interceptor, e.g. LoggingInterceptor",
				},
			],
			actions: [
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/interceptors/{{ name }}.ts",
					templateFile: "templates/interceptor/Interceptor.hbs",
				},
				{
					type: "appendBarrel",
					data: { folder: "interceptors" },
				},
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new InterceptorGenerator(plop, serverWorkspaces);
	}
}
