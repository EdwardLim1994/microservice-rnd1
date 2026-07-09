import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from '@rstest/core';
import {
  listDeployableApps,
  readAppVersion,
  writeAppVersion,
} from '../../src/release/apps';

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'script-apps-'));
  for (const [dir, name, version] of [
    ['servers', 'test1', '1.3.0'],
    ['frontends', 'mfe1', '0.9.0'],
    ['apps', 'web1', '2.1.0'],
  ] as const) {
    const appPath = join(repoRoot, dir, name);
    mkdirSync(appPath, { recursive: true });
    writeFileSync(
      join(appPath, 'package.json'),
      JSON.stringify({ name, version }),
    );
  }
  // packages/* must never be picked up as a deployable app.
  mkdirSync(join(repoRoot, 'packages', 'api'), { recursive: true });
  writeFileSync(
    join(repoRoot, 'packages', 'api', 'package.json'),
    JSON.stringify({ name: 'api', version: '1.0.0' }),
  );
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

test('listDeployableApps finds every app under servers/frontends/apps', () => {
  const apps = listDeployableApps(repoRoot);
  const names = apps.map((a) => a.name).sort();
  expect(names).toEqual(['mfe1', 'test1', 'web1']);
});

test('listDeployableApps excludes packages/*', () => {
  const apps = listDeployableApps(repoRoot);
  expect(apps.some((a) => a.name === 'api')).toBe(false);
});

test('readAppVersion reads the version field from the app package.json', async () => {
  const [app] = listDeployableApps(repoRoot).filter((a) => a.name === 'test1');
  expect(app).toBeDefined();
  expect(await readAppVersion(repoRoot, app!)).toBe('1.3.0');
});

test('writeAppVersion updates the version field in place', async () => {
  const [app] = listDeployableApps(repoRoot).filter((a) => a.name === 'test1');
  expect(app).toBeDefined();
  await writeAppVersion(repoRoot, app!, '1.4.0-rc1');
  expect(await readAppVersion(repoRoot, app!)).toBe('1.4.0-rc1');
});
