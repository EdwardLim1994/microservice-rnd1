import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightVersions from "starlight-versions";

// RC versions — excluded from production build
// Add new RC strings here as development progresses
// Remove from this list when version is promoted to stable
const RC_VERSIONS = ["1.0.0-rc1", "1.0.0-rc2"];

const IS_PRODUCTION = process.env.NODE_ENV === "production";

export default defineConfig({
	integrations: [
		starlight({
			title: "[Project Name] Docs",
			description:
				"Business logic, API references, architecture, and data flow documentation",

			plugins: [
				starlightVersions({
					versions: [
						// Stable versions — always visible
						{ slug: "1.0.0", label: "v1.0.0" },

						// RC versions — visible in dev, hidden in production
						...(!IS_PRODUCTION
							? RC_VERSIONS.map((v) => ({ slug: v, label: `${v} (RC)` }))
							: []),
					],
					// Default to latest stable when no version is selected
					current: { label: "Next (unreleased)" },
				}),
			],

			sidebar: [
				{
					label: "Business Logic",
					autogenerate: { directory: "business-logic" },
				},
				{
					label: "API Reference",
					autogenerate: { directory: "api" },
				},
				{
					label: "Architecture",
					autogenerate: { directory: "architecture" },
				},
				{
					label: "Data Flows",
					autogenerate: { directory: "data-flows" },
				},
				{
					label: "SDLC",
					autogenerate: { directory: "sdlc" },
				},
			],

			// MDX components available in all .mdx files
			components: {
				// Override or extend Starlight components here if needed
			},

			// Social links
			social: {
				github: "https://github.com/[org]/[repo]",
			},

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
