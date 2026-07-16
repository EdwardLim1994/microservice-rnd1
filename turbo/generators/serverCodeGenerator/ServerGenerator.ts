import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { appendRootComposeInclude, copyWithSubstitutions } from "../helpers";

const TEMPLATES_DIR = path.join(process.cwd(), "turbo", "generators", "templates", "server");

export default class ServerGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		// Registers the new server's docker-compose.yml in servers/docker-compose.yml's own
		// `include:` list (itself included by the root docker-compose.yml — see root CLAUDE.md's
		// Layout section), so `docker compose up` from repo root actually brings it up.
		// Named distinctly from any other generator's action of a similar purpose —
		// plop.setActionType is a single global registry keyed by name, not scoped per
		// generator, so a same-named registration elsewhere would silently overwrite this one
		// (confirmed the hard way: this exact collision happened with ProjectGenerator's).
		plop.setActionType("appendServerComposeInclude", (answers) => {
			const { name } = answers as { name: string };
			return appendRootComposeInclude(process.cwd(), "servers", name);
		});

		plop.setActionType("copyServerDeployConfig", (answers) => {
			const { name } = answers as { name: string };
			const destRoot = path.join(process.cwd(), "servers", name);
			for (const dir of ["helm", "terraform"]) {
				copyWithSubstitutions(path.join(TEMPLATES_DIR, dir), path.join(destRoot, dir), { name });
			}
			return `servers/${name}/{helm,terraform}`;
		});

		plop.setGenerator("server", {
			description:
				"Create a new server under servers/<name>, from the templates/server plop template. Registers its docker-compose.yml into servers/docker-compose.yml's include: list",
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
					templateFiles: ["templates/server/**/*", "!templates/server/helm/**", "!templates/server/terraform/**"],
					globOptions: { dot: true },
				},
				{ type: "copyServerDeployConfig" },
				{ type: "appendServerComposeInclude" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerGenerator(plop);
	}
}
