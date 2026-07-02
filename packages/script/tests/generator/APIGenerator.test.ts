import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('generate() logs the default apiLocation/path before generating', async () => {
  const base = mkdtempSync(join(tmpdir(), 'script-apigen-'));
  try {
    await APIGenerator.init('demo1').withBarrel(base).generate();

    expect(
      calls.some(
        (c) =>
          c.method === 'log' &&
          String(c.args[0]).includes(
            'API will be generated in ../../packages/api/src/generated',
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

test('generate() skips graphql-codegen and protoc when neither binary is installed', async () => {
  const base = mkdtempSync(join(tmpdir(), 'script-apigen-'));
  try {
    await APIGenerator.init('demo1').withBarrel(base).generate();

    expect(
      calls.some(
        (c) =>
          c.method === 'warn' &&
          String(c.args[0]).includes('GraphQL Codegen is not installed'),
      ),
    ).toBe(true);
    expect(
      calls.some(
        (c) =>
          c.method === 'warn' &&
          String(c.args[0]).includes('Protoc is not installed'),
      ),
    ).toBe(true);
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
