import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
	integrations: [
		starlight({
			title: "[Project Name] Docs",
			description:
				"Business logic, API references, architecture, and data flow documentation",

			// starlight-versions (docs versioning) was configured here but never actually set up —
			// it hard-requires a real snapshot for every declared version (its own provisioning
			// step) and refuses to start with zero versions declared either ("At least one version
			// of the documentation must be defined."), so there's no valid config for a docs site
			// that hasn't created its first version snapshot yet. Add it back once that's done —
			// `plugins: [starlightVersions({ versions: [...], current: {...} })]`.

			sidebar: [
				{
					label: "Business Logic",
					items: [{ autogenerate: { directory: "business-logic" } }],
				},
				{
					label: "API Reference",
					items: [{ autogenerate: { directory: "api" } }],
				},
				{
					label: "Architecture",
					items: [{ autogenerate: { directory: "architecture" } }],
				},
				{
					label: "Data Flows",
					items: [{ autogenerate: { directory: "data-flows" } }],
				},
				{
					label: "SDLC",
					items: [{ autogenerate: { directory: "sdlc" } }],
				},
			],

			// MDX components available in all .mdx files
			components: {
				// Override or extend Starlight components here if needed
			},

			// Social links
			social: [
				{ icon: "github", label: "GitHub", href: "https://github.com/[org]/[repo]" },
			],

			// Edit links point to source files on GitHub
			editLink: {
				baseUrl:
					"https://github.com/[org]/[repo]/edit/main/docs/src/content/docs/",
			},

			// Last updated timestamps from git
			lastUpdated: true,

			// Pagination between pages
			pagination: true,
		}),
	],
});
