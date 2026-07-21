import { expect, test } from '@rstest/core';
import { deriveSession } from '../../../src/modules/auth/lib/deriveSession';

function makeJwt(payload: Record<string, unknown>) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

test('returns must-change-password when the payload requires it, regardless of role', () => {
  const payload = {
    accessToken: 'a',
    refreshToken: 'r',
    idToken: makeJwt({ groups: ['hr-admin'] }),
    mustChangePassword: true,
  };
  expect(deriveSession(payload)).toEqual({ status: 'must-change-password' });
});

test('returns signed-in with role hr-admin when the idToken groups claim includes hr-admin', () => {
  const payload = {
    accessToken: 'a',
    refreshToken: 'r',
    idToken: makeJwt({ groups: ['hr-admin'] }),
    mustChangePassword: false,
  };
  expect(deriveSession(payload)).toEqual({
    status: 'signed-in',
    role: 'hr-admin',
  });
});

test('returns signed-in with role supervisor when the idToken groups claim includes supervisor', () => {
  const payload = {
    accessToken: 'a',
    refreshToken: 'r',
    idToken: makeJwt({ groups: ['supervisor'] }),
    mustChangePassword: false,
  };
  expect(deriveSession(payload)).toEqual({
    status: 'signed-in',
    role: 'supervisor',
  });
});

test('defaults to role employee when no recognized group is present', () => {
  const payload = {
    accessToken: 'a',
    refreshToken: 'r',
    idToken: makeJwt({ groups: [] }),
    mustChangePassword: false,
  };
  expect(deriveSession(payload)).toEqual({
    status: 'signed-in',
    role: 'employee',
  });
});
