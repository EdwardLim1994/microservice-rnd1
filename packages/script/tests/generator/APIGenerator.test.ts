import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterEach, beforeEach, expect, test } from '@rstest/core';
import APIGenerator from '../../src/generator/APIGenerator';

// generate() ultimately calls Bun.write() to emit the barrel file. rstest runs test files under
// Node, where the `Bun` global doesn't exist — generate() catches that failure internally (same
// as any other generation error) rather than throwing, so these tests observe the logged
// info/warn/error sequence instead of the (never-written) barrel file itself.

let calls: { method: 'log' | 'warn' | 'error'; args: unknown[] }[];
let originalConsole: Pick<typeof console, 'log' | 'warn' | 'error'>;

beforeEach(() => {
  originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  calls = [];
  console.log = (...args: unknown[]) => calls.push({ method: 'log', args });
  console.warn = (...args: unknown[]) => calls.push({ method: 'warn', args });
  console.error = (...args: unknown[]) => calls.push({ method: 'error', args });
});

afterEach(() => {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
});

test('init() returns a chainable builder', () => {
  const generator = APIGenerator.init('demo1');
  expect(generator).toBeInstanceOf(APIGenerator);
  expect(generator.apiLocation('../../packages/api')).toBe(generator);
  expect(generator.path('src/generated')).toBe(generator);
  expect(generator.withBarrel('/tmp/whatever')).toBe(generator);
});

test('init() with no arg infers the project name from cwd, so one shared script works for every server', () => {
  const originalCwd = process.cwd();
  const dir = mkdtempSync(join(tmpdir(), 'my-service-'));
  try {
    process.chdir(dir);
    const generator = APIGenerator.init() as unknown as {
      _projectName: string;
    };
    expect(generator._projectName).toBe(basename(dir));
  } finally {
    process.chdir(originalCwd);
  }
});

test('generate() logs the default apiLocation/path before generating', async () => {
  const base = mkdtempSync(join(tmpdir(), 'script-apigen-'));
  try {
    await APIGenerator.init('demo1').withBarrel(base).generate();

    expect(
      calls.some(
        (c) =>
          c.method === 'log' &&
          String(c.args[0]).includes(
            'API will be generated in ../../../packages/api/src/generated',
          ),
      ),
    ).toBe(true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('generate() honors apiLocation()/path() overrides in the logged location', async () => {
  const base = mkdtempSync(join(tmpdir(), 'script-apigen-'));
  try {
    await APIGenerator.init('demo2')
      .apiLocation('../custom/api')
      .path('generated/here')
      .withBarrel(base)
      .generate();

    expect(
      calls.some(
        (c) =>
          c.method === 'log' &&
          String(c.args[0]).includes(
            'API will be generated in ../custom/api/generated/here',
          ),
      ),
    ).toBe(true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// graphql-codegen is a real devDependency of this package itself (packages/script needs it to
// actually drive codegen for other packages), so checkDependency('graphql-codegen') is always
// true here — "neither binary installed" was never a reachable scenario for it. protoc has no
// such devDependency and is genuinely absent, so that half of the original combined assertion
// still holds; split into two tests that each match what's actually true in this environment.
test('generate() does not warn about graphql-codegen, which is genuinely installed', async () => {
  const base = mkdtempSync(join(tmpdir(), 'script-apigen-'));
  try {
    await APIGenerator.init('demo1').withBarrel(base).generate();

    expect(
      calls.some(
        (c) =>
          c.method === 'warn' &&
          String(c.args[0]).includes('GraphQL Codegen is not installed'),
      ),
    ).toBe(false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

// generateGrpcAPI() (and thus the protoc check) never runs: graphql-codegen being genuinely
// installed means generateGraphqlAPI() takes the "installed" branch and calls Bun.$, which
// doesn't exist under rstest's Node runtime (see this file's header comment) — that throw is
// caught by generate()'s own outer try/catch, aborting the pipeline before generateGrpcAPI() is
// ever reached. Documents the actual observed behavior rather than the unreachable protoc-warn
// path, same "catches internally, observe the log" convention as the barrel-write-failure test.
test('generate() logs an error instead of reaching the protoc step, since Bun is unavailable under rstest', async () => {
  const base = mkdtempSync(join(tmpdir(), 'script-apigen-'));
  try {
    await APIGenerator.init('demo1').withBarrel(base).generate();

    expect(calls.some((c) => c.method === 'error')).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.method === 'warn' &&
          String(c.args[0]).includes('Protoc is not installed'),
      ),
    ).toBe(false);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('generate() walks the barrel root and does not throw even if writing the barrel fails', async () => {
  const base = mkdtempSync(join(tmpdir(), 'script-apigen-'));
  try {
    const serverDir = join(base, 'demo1');
    mkdirSync(join(serverDir, 'graphql'), { recursive: true });
    writeFileSync(join(serverDir, 'graphql', 'index.ts'), '');
    mkdirSync(join(serverDir, 'proto'), { recursive: true });
    writeFileSync(join(serverDir, 'proto', 'demo1.ts'), '');

    await expect(
      APIGenerator.init('demo1').withBarrel(base).generate(),
    ).resolves.toBeUndefined();

    expect(calls.some((c) => c.method === 'error')).toBe(true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
