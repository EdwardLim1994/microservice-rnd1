import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type ReleaseManifest = {
  releaseBranch: string;
  releaseVersion: string;
  apps: Record<string, string>;
};

const MANIFEST_FILENAME = 'release-manifest.json';

export function manifestPath(repoRoot: string): string {
  return join(repoRoot, MANIFEST_FILENAME);
}

export function manifestExists(repoRoot: string): boolean {
  return existsSync(manifestPath(repoRoot));
}

export async function readManifest(repoRoot: string): Promise<ReleaseManifest> {
  return JSON.parse(await readFile(manifestPath(repoRoot), 'utf-8'));
}

export async function writeManifest(
  repoRoot: string,
  manifest: ReleaseManifest,
): Promise<void> {
  await writeFile(
    manifestPath(repoRoot),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
