import { expect, test } from '@rstest/core';
import {
  decodeJwt,
  resolveRole,
} from '../../../src/modules/auth/lib/decodeJwt';

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

test('decodeJwt decodes the payload segment', () => {
  const token = makeJwt({ groups: ['hr-admin'], sub: 'user-1' });
  expect(decodeJwt(token)).toEqual({ groups: ['hr-admin'], sub: 'user-1' });
});

test('decodeJwt returns null for a malformed token', () => {
  expect(decodeJwt('not-a-jwt')).toBeNull();
});

test('resolveRole returns hr-admin when present in groups', () => {
  expect(resolveRole({ groups: ['employee', 'hr-admin'] })).toBe('hr-admin');
});

test('resolveRole returns supervisor when present and hr-admin is not', () => {
  expect(resolveRole({ groups: ['employee', 'supervisor'] })).toBe(
    'supervisor',
  );
});

test('resolveRole defaults to employee when no recognized group is present', () => {
  expect(resolveRole({ groups: ['employee'] })).toBe('employee');
  expect(resolveRole({})).toBe('employee');
  expect(resolveRole(null)).toBe('employee');
});
