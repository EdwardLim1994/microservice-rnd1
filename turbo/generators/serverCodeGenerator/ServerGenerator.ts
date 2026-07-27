import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { appendRootTiltfileInclude } from "../helpers";

export default class ServerGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		// Registers the new server's Tiltfile in apps/servers/Tiltfile's own include list (itself
		// included by the root Tiltfile — see services/Tiltfile for the established pattern), so
		// `tilt up` from repo root actually brings it up.
		// Named distinctly from any other generator's action of a similar purpose —
		// plop.setActionType is a single global registry keyed by name, not scoped per
		// generator, so a same-named registration elsewhere would silently overwrite this one
		// (confirmed the hard way: this exact collision happened with ProjectGenerator's).
		plop.setActionType("appendServerTiltfileInclude", (answers) => {
			const { name } = answers as { name: string };
			return appendRootTiltfileInclude(process.cwd(), "apps/servers", name);
		});

		plop.setGenerator("server", {
			description:
				"Create a new server under apps/servers/<name>, from the templates/server plop template. Registers its Tiltfile into apps/servers/Tiltfile's include list",
			prompts: [
				{
					type: "input",
					name: "name",
					message: "New server name:",
					validate: (input: string) => {
						if (!/^[a-z][a-z0-9-]*$/.test(input)) {
							return "Use lowercase letters, digits, and hyphens, starting with a letter";
						}
						if (
							fs.existsSync(path.join(process.cwd(), "apps", "servers", input))
						) {
							return `apps/servers/${input} already exists`;
						}
						return true;
					},
				},
			],
			actions: [
				{
					type: "addMany",
					destination: "{{ turbo.paths.root }}/apps/servers/{{ name }}",
					base: "templates/server",
					templateFiles: ["templates/server/**/*"],
					globOptions: { dot: true },
				},
				{ type: "appendServerTiltfileInclude" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new ServerGenerator(plop);
	}
}
