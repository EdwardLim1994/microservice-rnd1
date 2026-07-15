import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Workspace globs that hold independently deployable, independently versioned apps. */
const DEPLOYABLE_ROOTS = ['servers', 'frontends', 'apps'];

export type DeployableApp = {
  name: string;
  /** Path relative to the repo root, e.g. "servers/auth". */
  path: string;
};

/**
 * `packages/*` are shared libraries versioned/released with their consumers, not independently
 * — they're deliberately excluded from the deployable-app scan.
 */
export function listDeployableApps(repoRoot: string): DeployableApp[] {
  const apps: DeployableApp[] = [];
  for (const root of DEPLOYABLE_ROOTS) {
    const rootPath = join(repoRoot, root);
    if (!existsSync(rootPath)) continue;
    for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const appPath = join(root, entry.name);
      if (!existsSync(join(repoRoot, appPath, 'package.json'))) continue;
      apps.push({ name: entry.name, path: appPath });
    }
  }
  return apps;
}

/** Returns the subset of `apps` with at least one file changed relative to `baseRef`. */
export async function touchedApps(
  repoRoot: string,
  apps: DeployableApp[],
  baseRef: string,
): Promise<DeployableApp[]> {
  const diff = await Bun.$`git diff --name-only ${baseRef}...HEAD`
    .cwd(repoRoot)
    .text();
  const changedFiles = diff.split('\n').filter(Boolean);
  return apps.filter((app) =>
    changedFiles.some((file) => file.startsWith(`${app.path}/`)),
  );
}

export async function readAppVersion(
  repoRoot: string,
  app: DeployableApp,
): Promise<string> {
  const pkgPath = join(repoRoot, app.path, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  if (typeof pkg.version !== 'string') {
    throw new TypeError(`${app.path}/package.json has no "version" field`);
  }
  return pkg.version;
}

export async function writeAppVersion(
  repoRoot: string,
  app: DeployableApp,
  version: string,
): Promise<void> {
  const pkgPath = join(repoRoot, app.path, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  pkg.version = version;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
