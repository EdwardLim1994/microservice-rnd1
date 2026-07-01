// servers/demo3/prisma.config.ts
import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: path.join("src", "schemas", "prisma", "schema.prisma"),
	migrations: {
		path: path.join("src", "schemas", "prisma", "migrations"),
	},
	datasource: {
		url: env("DATABASE_URL"),
	},
});
