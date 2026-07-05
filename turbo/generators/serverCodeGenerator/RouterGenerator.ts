import type { PlopTypes } from "@turbo/gen";
import { workspaceChoices } from "../helpers";

export default class RouterGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		plop.setGenerator("router", {
			description:
				'Generate a router (grpc, graphql, or cron; stub methods throw "Not implemented") into <server>/src/routers, registered in its barrel',
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
					type: "list",
					name: "routerType",
					message: "Router type:",
					choices: [
						{ name: "gRPC", value: "Grpc" },
						{ name: "GraphQL", value: "Graphql" },
						{ name: "Cron", value: "Cron" },
					],
				},
				{
					type: "input",
					name: "name",
					message: "Router name (PascalCase, ending in <Type>Router):",
					validate: (input: string, answers: { routerType?: string }) => {
						const suffix = `${answers.routerType}Router`;
						const re = new RegExp(`^[A-Z][A-Za-z0-9]*${suffix}$`);
						return re.test(input) || `Use PascalCase ending in ${suffix}, e.g. Demo${suffix}`;
					},
				},
			],
			actions: [
				{
					type: "add",
					path: "{{ turbo.paths.root }}/{{ location }}/src/routers/{{ name }}.ts",
					templateFile: "templates/router/{{ routerType }}Router.hbs",
				},
				{
					type: "appendBarrel",
					data: { folder: "routers" },
				},
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI, serverWorkspaces: string[]) {
		return new RouterGenerator(plop, serverWorkspaces);
	}
}
