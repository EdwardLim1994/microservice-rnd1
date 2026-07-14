import { expect, test } from '@rstest/core';
import { AuthentikApiError, type AuthentikClient } from 'server';
import { GraphQLError } from 'graphql';
import LoginUseCase from '../../src/usecases/LoginUseCase';

// Manual test double — no vi.fn()/module mocking available under rstest (see
// packages/server/CLAUDE.md's Testing section). Tracks calls by hand via a plain array so tests
// can assert both "was it called" and "with what args" without a spy library.
function makeMockAuthentik(
  signInImpl: (username: string, password: string) => Promise<unknown>,
) {
  const signInCalls: { username: string; password: string }[] = [];
  const authentik = {
    async signIn(username: string, password: string) {
      signInCalls.push({ username, password });
      return signInImpl(username, password);
    },
  };
  return { authentik: authentik as unknown as AuthentikClient, signInCalls };
}

const VALID_TOKEN_RESPONSE = {
  access_token: 'access-token-value',
  refresh_token: 'refresh-token-value',
  id_token: 'id-token-value',
  token_type: 'bearer',
  expires_in: 3600,
};

test('valid login returns a payload containing accessToken, refreshToken, and idToken', async () => {
  const { authentik, signInCalls } = makeMockAuthentik(async () => VALID_TOKEN_RESPONSE);
  const useCase = new LoginUseCase({ authentik });

  const result = await useCase.execute({ email: 'user@example.com', password: 'correct-password' });

  expect(result).toEqual(
    expect.objectContaining({
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      idToken: 'id-token-value',
    }),
  );
  expect(signInCalls).toEqual([{ username: 'user@example.com', password: 'correct-password' }]);
});

test('incorrect password throws a GraphQLError with an invalid-credentials extensions.code', async () => {
  const { authentik } = makeMockAuthentik(async () => {
    throw new AuthentikApiError(400, { component: 'ak-stage-password', response_errors: {} });
  });
  const useCase = new LoginUseCase({ authentik });

  await expect(
    useCase.execute({ email: 'user@example.com', password: 'wrong-password' }),
  ).rejects.toMatchObject({
    extensions: { code: 'INVALID_CREDENTIALS' },
  });
});

test('non-existent email throws the exact same invalid-credentials error as incorrect password (anti-enumeration)', async () => {
  const wrongPasswordDouble = makeMockAuthentik(async () => {
    throw new AuthentikApiError(400, { component: 'ak-stage-password', response_errors: {} });
  });
  const nonExistentEmailDouble = makeMockAuthentik(async () => {
    throw new AuthentikApiError(400, { component: 'ak-stage-identification', response_errors: {} });
  });

  const wrongPasswordError: GraphQLError = await new LoginUseCase({
    authentik: wrongPasswordDouble.authentik,
  })
    .execute({ email: 'user@example.com', password: 'wrong-password' })
    .catch((error) => error);

  const nonExistentEmailError: GraphQLError = await new LoginUseCase({
    authentik: nonExistentEmailDouble.authentik,
  })
    .execute({ email: 'nobody@example.com', password: 'whatever' })
    .catch((error) => error);

  expect(wrongPasswordError).toBeInstanceOf(GraphQLError);
  expect(nonExistentEmailError).toBeInstanceOf(GraphQLError);
  // Deliberately identical shape/code — the client must not be able to distinguish "wrong
  // password" from "no such account" (see issue #22's anti-enumeration requirement).
  expect(nonExistentEmailError.message).toBe(wrongPasswordError.message);
  expect(nonExistentEmailError.extensions).toEqual(wrongPasswordError.extensions);
  expect(nonExistentEmailError.extensions.code).toBe('INVALID_CREDENTIALS');
});

test('authentik unreachable throws a generic GraphQLError, not INVALID_CREDENTIALS', async () => {
  const { authentik } = makeMockAuthentik(async () => {
    throw new TypeError('fetch failed');
  });
  const useCase = new LoginUseCase({ authentik });

  const error: GraphQLError = await useCase
    .execute({ email: 'user@example.com', password: 'whatever' })
    .catch((error) => error);

  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions.code).not.toBe('INVALID_CREDENTIALS');
  // Must not leak the raw transport error message to the client.
  expect(error.message).not.toContain('fetch failed');
});

test('an unexpected Authentik response shape throws a generic server error, not a raw leak of the response', async () => {
  const malformedResponse = {
    weird_internal_field: 'super-secret-authentik-internal-detail',
    // no access_token/refresh_token/id_token at all
  };
  const { authentik } = makeMockAuthentik(async () => malformedResponse);
  const useCase = new LoginUseCase({ authentik });

  const error: GraphQLError = await useCase
    .execute({ email: 'user@example.com', password: 'correct-password' })
    .catch((error) => error);

  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions.code).not.toBe('INVALID_CREDENTIALS');
  expect(error.message).not.toContain('weird_internal_field');
  expect(error.message).not.toContain('super-secret-authentik-internal-detail');
  expect(JSON.stringify(error.extensions)).not.toContain('super-secret-authentik-internal-detail');
});

test('empty email and password are rejected before calling authentik at all', async () => {
  const { authentik, signInCalls } = makeMockAuthentik(async () => VALID_TOKEN_RESPONSE);
  const useCase = new LoginUseCase({ authentik });

  await expect(useCase.execute({ email: '', password: '' })).rejects.toBeInstanceOf(GraphQLError);

  expect(signInCalls).toHaveLength(0);
});
