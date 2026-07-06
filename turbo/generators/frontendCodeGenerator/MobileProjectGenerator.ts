import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";
import { findAvailableMobilePort } from "../helpers";

const STATIC_ASSETS_DIR = path.join(
	process.cwd(),
	"turbo",
	"generators",
	"templates",
	"mobile-project-static",
	"assets",
	"images",
);
const ASSET_FILES = ["adaptive-icon.png", "favicon.png", "icon.png", "splash-icon.png"];

function relToRoot(absPath: string): string {
	return path.relative(process.cwd(), absPath);
}

export default class MobileProjectGenerator {
	private constructor(plop: PlopTypes.NodePlopAPI) {
		// Runs before the "addMany" action below and mutates `answers` in place — node-plop
		// threads the same answers object through every action in a run, so `port` is visible to
		// addMany's own Handlebars rendering, exactly like the prompt-answered `name` is.
		plop.setActionType("computeMobileProjectData", (answers) => {
			const port = findAvailableMobilePort(process.cwd());
			Object.assign(answers as Record<string, unknown>, { port });
			return `Assigned port ${port}`;
		});

		// assets/images/*.png are binary PNGs — plop's "add"/"addMany" actions read+write
		// template files as UTF-8 text through Handlebars, which would corrupt them, so they're
		// copied directly instead of living inside templates/mobile-project/.
		plop.setActionType("copyMobileAssets", (answers) => {
			const { name } = answers as { name: string };
			const destDir = path.join(process.cwd(), "apps", name, "assets", "images");
			fs.mkdirSync(destDir, { recursive: true });
			for (const file of ASSET_FILES) {
				fs.copyFileSync(path.join(STATIC_ASSETS_DIR, file), path.join(destDir, file));
			}
			return `${relToRoot(destDir)} (+${ASSET_FILES.join(", ")})`;
		});

		plop.setGenerator("mobile", {
			description:
				"Create a new Expo Router mobile app under apps/<name>, modeled on apps/mobile (HeroUI Native + Uniwind + Apollo Client) — no Module Federation (not applicable to React Native) and no src/modules, add those with the 'module' generator",
			prompts: [
				{
					type: "input",
					name: "name",
					message: "New mobile app name:",
					validate: (input: string) => {
						if (!/^[a-z][a-z0-9-]*$/.test(input)) {
							return "Use lowercase letters, digits, and hyphens, starting with a letter";
						}
						if (fs.existsSync(path.join(process.cwd(), "apps", input))) {
							return `apps/${input} already exists`;
						}
						return true;
					},
				},
			],
			actions: [
				{ type: "computeMobileProjectData" },
				{
					type: "addMany",
					destination: "{{ turbo.paths.root }}/apps/{{ name }}",
					base: "templates/mobile-project",
					templateFiles: "templates/mobile-project/**/*",
					globOptions: { dot: true },
				},
				{ type: "copyMobileAssets" },
			],
		});
	}

	public static apply(plop: PlopTypes.NodePlopAPI) {
		return new MobileProjectGenerator(plop);
	}
}
