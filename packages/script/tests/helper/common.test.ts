import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from '@rstest/core';
import { checkDependency, createFolder, log } from '../../src/helper/common';

let originalConsole: Pick<typeof console, 'log' | 'warn' | 'error'>;
let calls: { method: 'log' | 'warn' | 'error'; args: unknown[] }[];

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

test('log.info writes an [INFO] prefixed message to console.log', () => {
  log.info('hello');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.method).toBe('log');
  expect(String(calls[0]?.args[0])).toContain('[INFO]: hello');
});

test('log.warn writes a [WARN] prefixed message to console.warn', () => {
  log.warn('careful');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.method).toBe('warn');
  expect(String(calls[0]?.args[0])).toContain('[WARN]: careful');
});

test('log.error writes an [ERROR] prefixed message to console.error', () => {
  log.error('broken');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.method).toBe('error');
  expect(String(calls[0]?.args[0])).toContain('[ERROR]: broken');
});

test('log.success writes a [SUCCESS] prefixed message to console.log', () => {
  log.success('done');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.method).toBe('log');
  expect(String(calls[0]?.args[0])).toContain('[SUCCESS]: done');
});

test('checkDependency returns true when the binary exists in node_modules/.bin', () => {
  expect(checkDependency('biome')).toBe(true);
});

test('checkDependency returns false when the binary does not exist', () => {
  expect(checkDependency('definitely-not-a-real-binary')).toBe(false);
});

test('createFolder creates a missing directory and logs success', () => {
  const base = mkdtempSync(join(tmpdir(), 'script-helper-'));
  try {
    const target = join(base, 'nested', 'dir');
    expect(existsSync(target)).toBe(false);

    createFolder(target);

    expect(existsSync(target)).toBe(true);
    expect(
      calls.some((c) => String(c.args[0]).includes('is created successfully')),
    ).toBe(true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('createFolder leaves an existing directory untouched and logs info', () => {
  const base = mkdtempSync(join(tmpdir(), 'script-helper-'));
  try {
    createFolder(base);

    expect(existsSync(base)).toBe(true);
    expect(
      calls.some((c) => String(c.args[0]).includes('already exists')),
    ).toBe(true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
