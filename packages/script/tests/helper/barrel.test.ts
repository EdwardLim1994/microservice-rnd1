import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from '@rstest/core';
import { collectSubDirExports } from '../../src/helper/barrel';

// writeSubDirBarrels is not covered here — it writes via Bun.write, and rstest
// runs test files under Node, where the `Bun` global doesn't exist.

let base: string;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'script-barrel-'));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

test('does nothing when the directory does not exist', async () => {
  const lines: string[] = [];
  await collectSubDirExports(
    join(base, 'missing'),
    'missing',
    lines,
    new Set(),
  );
  expect(lines).toEqual([]);
});

test('does nothing for an empty directory', async () => {
  const dir = join(base, 'empty');
  mkdirSync(dir);

  const lines: string[] = [];
  await collectSubDirExports(dir, 'empty', lines, new Set());
  expect(lines).toEqual([]);
});

test('exports a namespace for a directory containing non-index .ts files', async () => {
  const dir = join(base, 'demo1', 'proto', 'nested');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'message.ts'), '');
  writeFileSync(join(dir, 'index.ts'), '');

  const lines: string[] = [];
  await collectSubDirExports(dir, 'demo1/proto/nested', lines, new Set());

  // 'proto' is stripped from the namespace key ('proto'/'src'/'generated' are structural, not
  // part of the exported name)
  expect(lines).toEqual([
    'export * as Demo1Nested from "./demo1/proto/nested"',
  ]);
});

test('recurses into subdirectories, adding nested exports before the parent', async () => {
  const root = join(base, 'demo1', 'proto');
  const child = join(root, 'child');
  mkdirSync(child, { recursive: true });
  writeFileSync(join(root, 'top.ts'), '');
  writeFileSync(join(child, 'leaf.ts'), '');

  const lines: string[] = [];
  await collectSubDirExports(root, 'demo1/proto', lines, new Set());

  expect(lines).toEqual([
    'export * as Demo1Child from "./demo1/proto/child"',
    'export * as Demo1 from "./demo1/proto"',
  ]);
});

test('deduplicates entries that resolve to the same namespace key via the seen set', async () => {
  const protoDir = join(base, 'demo1', 'proto', 'shared');
  const generatedDir = join(base, 'demo1', 'generated', 'shared');
  mkdirSync(protoDir, { recursive: true });
  mkdirSync(generatedDir, { recursive: true });
  writeFileSync(join(protoDir, 'a.ts'), '');
  writeFileSync(join(generatedDir, 'a.ts'), '');

  const lines: string[] = [];
  const seen = new Set<string>();
  await collectSubDirExports(protoDir, 'demo1/proto/shared', lines, seen);
  await collectSubDirExports(
    generatedDir,
    'demo1/generated/shared',
    lines,
    seen,
  );

  // both paths reduce to the same 'demo1/shared' namespace key once 'proto'/'generated' are
  // stripped, so the second call is a no-op
  expect(lines).toEqual([
    'export * as Demo1Shared from "./demo1/proto/shared"',
  ]);
});

test('a subdirectory with only nested content (no own .ts files) still exports its own namespace', async () => {
  const dir = join(base, 'demo1', 'wrapper');
  const child = join(dir, 'child');
  mkdirSync(child, { recursive: true });
  writeFileSync(join(child, 'leaf.ts'), '');

  const lines: string[] = [];
  await collectSubDirExports(dir, 'demo1/wrapper', lines, new Set());

  expect(lines).toEqual([
    'export * as Demo1WrapperChild from "./demo1/wrapper/child"',
    'export * as Demo1Wrapper from "./demo1/wrapper"',
  ]);
});
