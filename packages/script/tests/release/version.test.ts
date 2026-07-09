import { expect, test } from '@rstest/core';
import {
  bumpMinorToRc1,
  bumpPatch,
  bumpRc,
  formatVersion,
  parseVersion,
  stripRc,
} from '../../src/release/version';

test('parseVersion parses a plain semver version', () => {
  expect(parseVersion('1.4.2')).toEqual({
    major: 1,
    minor: 4,
    patch: 2,
    rc: null,
  });
});

test('parseVersion parses an rc-suffixed version', () => {
  expect(parseVersion('1.4.0-rc3')).toEqual({
    major: 1,
    minor: 4,
    patch: 0,
    rc: 3,
  });
});

test('parseVersion rejects a malformed version', () => {
  expect(() => parseVersion('not-a-version')).toThrow();
});

test('formatVersion round-trips a plain version', () => {
  expect(formatVersion({ major: 2, minor: 0, patch: 1, rc: null })).toBe(
    '2.0.1',
  );
});

test('formatVersion round-trips an rc version', () => {
  expect(formatVersion({ major: 2, minor: 0, patch: 0, rc: 5 })).toBe(
    '2.0.0-rc5',
  );
});

test('bumpMinorToRc1 bumps minor, resets patch, seeds rc1', () => {
  expect(bumpMinorToRc1('1.3.0')).toBe('1.4.0-rc1');
});

test('bumpMinorToRc1 works from an already-rc version too', () => {
  expect(bumpMinorToRc1('1.3.0-rc4')).toBe('1.4.0-rc1');
});

test('bumpRc increments the rc counter only', () => {
  expect(bumpRc('1.4.0-rc1')).toBe('1.4.0-rc2');
});

test('bumpRc throws on a version with no rc suffix', () => {
  expect(() => bumpRc('1.4.0')).toThrow();
});

test('stripRc removes the rc suffix, leaving major.minor.patch untouched', () => {
  expect(stripRc('1.4.0-rc3')).toBe('1.4.0');
});

test('stripRc is a no-op on an already-final version', () => {
  expect(stripRc('1.4.0')).toBe('1.4.0');
});

test('bumpPatch increments the patch version', () => {
  expect(bumpPatch('1.4.0')).toBe('1.4.1');
});

test('bumpPatch throws on a pending rc version', () => {
  expect(() => bumpPatch('1.4.0-rc1')).toThrow();
});
