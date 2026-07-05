import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";

export default class ServerGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		plop.setGenerator("server", {
			description:
				"Create a new server under servers/<name>, from the templates/server plop template",
			prompts: [
				{
					type: "input",
					name: "name",
					message: "New server name:",
					validate: (input: string) => {
						if (!/^[a-z][a-z0-9-]*$/.test(input)) {
							return "Use lowercase letters, digits, and hyphens, starting with a letter";
						}
						if (fs.existsSync(path.join(process.cwd(), "servers", input))) {
							return `servers/${input} already exists`;
						}
						return true;
					},
				},
			],
			actions: [
				{
					type: "addMany",
					destination: "{{ turbo.paths.root }}/servers/{{ name }}",
					base: "templates/server",
					templateFiles: "templates/server/**/*",
					globOptions: { dot: true },
				},
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerGenerator(plop);
	}
}
