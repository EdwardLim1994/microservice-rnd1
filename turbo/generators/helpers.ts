import fs from "node:fs";
import path from "node:path";
import type { PlopTypes } from "@turbo/gen";

function isServerWorkspace(absDir: string): boolean {
	const pkgPath = path.join(absDir, "package.json");
	if (!fs.existsSync(pkgPath)) return false;
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
	const deps = { ...pkg.dependencies, ...pkg.devDependencies };
	return Boolean(deps.server);
}

// Only servers/<name> that actually depend on the `server` framework package.
export function findServerWorkspaces(root: string): string[] {
	const serversDir = path.join(root, "servers");
	if (!fs.existsSync(serversDir)) return [];
	return fs
		.readdirSync(serversDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join("servers", entry.name))
		.filter((rel) => isServerWorkspace(path.join(root, rel)));
}

// Only servers that have a Prisma schema, i.e. actually have a PrismaClient for
// BaseRepository<PrismaClient> to be constructed against.
export function findPrismaServerWorkspaces(root: string): string[] {
	return findServerWorkspaces(root).filter((rel) =>
		fs.existsSync(path.join(root, rel, "src", "schemas", "prisma", "schema.prisma")),
	);
}

// The inverse: server workspaces that don't have a database yet, i.e. eligible
// targets for the "database" extension generator.
export function findServerWorkspacesWithoutPrisma(root: string): string[] {
	const withPrisma = new Set(findPrismaServerWorkspaces(root));
	return findServerWorkspaces(root).filter((rel) => !withPrisma.has(rel));
}

// The inverse: server workspaces that don't have gRPC wired up yet, i.e. eligible
// targets for the "grpc" extension generator.
export function findServerWorkspacesWithoutGrpc(root: string): string[] {
	return findServerWorkspaces(root).filter((rel) => {
		const appPath = path.join(root, rel, "src", "app.ts");
		if (!fs.existsSync(appPath)) return true;
		return !fs.readFileSync(appPath, "utf-8").includes("GrpcDriver");
	});
}

// Shared "list" prompt choices for a location prompt, with a disabled placeholder
// when no eligible workspace was found.
export function workspaceChoices(
	workspaces: string[],
	emptyMessage: string,
): PlopTypes.PromptQuestion["choices"] {
	return workspaces.length > 0
		? workspaces
		: [{ name: emptyMessage, value: "", disabled: true }];
}

// Detects a file's own indentation style (servers are inconsistent: demo1 uses
// 2-space, demo2 uses tabs), so a JSON/TS rewrite can preserve it instead of clobbering it.
export function detectIndent(raw: string): string {
	const match = /\n([ \t]+)\S/.exec(raw);
	return match ? match[1] : "\t";
}

function appendBarrelExport(absBarrelPath: string, name: string): string {
	fs.mkdirSync(path.dirname(absBarrelPath), { recursive: true });
	const line = `export { default as ${name} } from "./${name}";`;
	const existing = fs.existsSync(absBarrelPath) ? fs.readFileSync(absBarrelPath, "utf-8") : "";
	if (existing.includes(line)) {
		return `${absBarrelPath} already exports ${name}`;
	}
	const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
	fs.writeFileSync(absBarrelPath, `${existing}${separator}${line}\n`);
	return `${absBarrelPath} (+${name})`;
}

// Registers the "appendBarrel" custom action, shared by usecase/repository/interceptor/router
// generators: appends `export { default as <name> } from "./<name>";` to <location>/src/<folder>/index.ts,
// creating the folder/barrel if it doesn't exist yet.
export function registerAppendBarrelAction(plop: PlopTypes.NodePlopAPI): void {
	plop.setActionType("appendBarrel", (answers, config) => {
		const { location, name } = answers as { location: string; name: string };
		const { folder } = (config.data ?? {}) as { folder: string };
		const absBarrel = path.join(process.cwd(), location, "src", folder, "index.ts");
		return appendBarrelExport(absBarrel, name);
	});
}
