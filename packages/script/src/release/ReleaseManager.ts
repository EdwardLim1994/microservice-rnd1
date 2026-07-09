import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { log } from '../helper/common';
import {
  type DeployableApp,
  listDeployableApps,
  readAppVersion,
  touchedApps,
  writeAppVersion,
} from './apps';
import {
  manifestExists,
  type ReleaseManifest,
  readManifest,
  writeManifest,
} from './manifest';
import { bumpMinorToRc1, bumpPatch, bumpRc, stripRc } from './version';

async function readRootVersion(repoRoot: string): Promise<string> {
  const pkgPath = join(repoRoot, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  if (typeof pkg.version !== 'string') {
    throw new TypeError('root package.json has no "version" field');
  }
  return pkg.version;
}

async function writeRootVersion(
  repoRoot: string,
  version: string,
): Promise<void> {
  const pkgPath = join(repoRoot, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
  pkg.version = version;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

export default class ReleaseManager {
  private constructor(private readonly _repoRoot: string) {}

  public static init(repoRoot: string = process.cwd()) {
    return new ReleaseManager(repoRoot);
  }

  /**
   * Run once when a release branch is cut from main. Diffs against `baseRef` (default `main`)
   * to find every deployable app touched so far, bumps each to its next minor at `-rc1`, bumps
   * the release-bundle version the same way, and writes the manifest.
   */
  public async cutRelease(
    releaseBranch: string,
    baseRef = 'main',
  ): Promise<ReleaseManifest> {
    if (manifestExists(this._repoRoot)) {
      throw new Error(
        `${releaseBranch} already has a release-manifest.json — use bumpRc instead`,
      );
    }

    const allApps = listDeployableApps(this._repoRoot);
    const touched = await touchedApps(this._repoRoot, allApps, baseRef);
    if (touched.length === 0) {
      throw new Error(
        `No deployable apps changed between ${baseRef} and HEAD — nothing to release`,
      );
    }

    const apps: Record<string, string> = {};
    for (const app of touched) {
      const current = await readAppVersion(this._repoRoot, app);
      const next = bumpMinorToRc1(current);
      await writeAppVersion(this._repoRoot, app, next);
      apps[app.name] = next;
      log.success(`${app.name}: ${current} -> ${next}`);
    }

    const rootCurrent = await readRootVersion(this._repoRoot);
    const releaseVersion = bumpMinorToRc1(rootCurrent);
    await writeRootVersion(this._repoRoot, releaseVersion);

    const manifest: ReleaseManifest = { releaseBranch, releaseVersion, apps };
    await writeManifest(this._repoRoot, manifest);
    log.success(
      `release-manifest.json written: ${releaseBranch} @ ${releaseVersion}`,
    );
    return manifest;
  }

  /**
   * Run on every subsequent push to the release branch (UAT-failure fix, or a newly touched
   * app). Idempotent: apps already in the manifest get their rc counter incremented, apps
   * touched for the first time this cycle are seeded fresh at `-rc1`.
   */
  public async bumpRc(baseRef = 'main'): Promise<ReleaseManifest> {
    const manifest = await readManifest(this._repoRoot);

    const allApps = listDeployableApps(this._repoRoot);
    const touched = await touchedApps(this._repoRoot, allApps, baseRef);

    for (const app of touched) {
      const currentInManifest = manifest.apps[app.name];
      if (currentInManifest) {
        const next = bumpRc(currentInManifest);
        manifest.apps[app.name] = next;
        await writeAppVersion(this._repoRoot, app, next);
        log.success(`${app.name}: ${currentInManifest} -> ${next}`);
      } else {
        const current = await readAppVersion(this._repoRoot, app);
        const next = bumpMinorToRc1(current);
        manifest.apps[app.name] = next;
        await writeAppVersion(this._repoRoot, app, next);
        log.success(`${app.name}: ${current} -> ${next} (newly touched)`);
      }
    }

    manifest.releaseVersion = bumpRc(manifest.releaseVersion);
    await writeRootVersion(this._repoRoot, manifest.releaseVersion);
    await writeManifest(this._repoRoot, manifest);
    log.success(`release-manifest.json bumped to ${manifest.releaseVersion}`);
    return manifest;
  }

  /**
   * Run when the release branch merges into main after UAT passes. Strips the `-rcN` suffix
   * from every app in the manifest and from the release-bundle version itself.
   */
  public async promote(): Promise<ReleaseManifest> {
    const manifest = await readManifest(this._repoRoot);
    const allApps = listDeployableApps(this._repoRoot);
    const byName = new Map(allApps.map((app) => [app.name, app] as const));

    for (const [name, version] of Object.entries(manifest.apps)) {
      const app = byName.get(name);
      if (!app) {
        throw new Error(
          `Manifest references app "${name}" which no longer exists on disk`,
        );
      }
      const final = stripRc(version);
      manifest.apps[name] = final;
      await writeAppVersion(this._repoRoot, app, final);
      log.success(`${name}: ${version} -> ${final}`);
    }

    manifest.releaseVersion = stripRc(manifest.releaseVersion);
    await writeRootVersion(this._repoRoot, manifest.releaseVersion);
    await writeManifest(this._repoRoot, manifest);
    log.success(`release ${manifest.releaseVersion} promoted to main`);
    return manifest;
  }

  /**
   * Deployable app names touched relative to `baseRef` — used by CI to figure out which app a
   * hotfix branch targets without duplicating the diff logic in shell/jq.
   */
  public async touchedAppNames(baseRef = 'main'): Promise<string[]> {
    const allApps = listDeployableApps(this._repoRoot);
    const touched = await touchedApps(this._repoRoot, allApps, baseRef);
    return touched.map((app) => app.name);
  }

  /**
   * Run on a hotfix branch cut from main. Bumps only the given app's patch version — independent
   * of any in-flight release manifest.
   */
  public async hotfix(appName: string): Promise<DeployableApp & { version: string }> {
    const allApps = listDeployableApps(this._repoRoot);
    const app = allApps.find((a) => a.name === appName);
    if (!app) {
      throw new Error(`Unknown app "${appName}"`);
    }
    const current = await readAppVersion(this._repoRoot, app);
    const next = bumpPatch(current);
    await writeAppVersion(this._repoRoot, app, next);
    log.success(`${appName}: ${current} -> ${next} (hotfix)`);
    return { ...app, version: next };
  }
}
