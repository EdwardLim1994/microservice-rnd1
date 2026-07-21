import { expect, test } from '@rstest/core';
import { AuthentikApiError, type AuthentikClient } from 'server';
import { GraphQLError } from 'graphql';
import SignInUseCase from '../../src/usecases/SignInUseCase';

// Manual test double — no vi.fn()/module mocking available under rstest (see
// packages/server/CLAUDE.md's Testing section). Tracks calls by hand via a plain array so tests
// can assert both "was it called" and "with what args" without a spy library.
function makeMockAuthentik(options: {
  signInImpl: (username: string, password: string) => Promise<unknown>;
  getUserImpl?: (username: string) => Promise<unknown>;
}) {
  const signInCalls: { username: string; password: string }[] = [];
  const getUserCalls: string[] = [];
  const authentik = {
    async signIn(username: string, password: string) {
      signInCalls.push({ username, password });
      return options.signInImpl(username, password);
    },
    async getUser(username: string) {
      getUserCalls.push(username);
      return options.getUserImpl
        ? options.getUserImpl(username)
        : { pk: 1, username, email: username, attributes: {} };
    },
  };
  return { authentik: authentik as unknown as AuthentikClient, signInCalls, getUserCalls };
}

const VALID_TOKEN_RESPONSE = {
  access_token: 'access-token-value',
  refresh_token: 'refresh-token-value',
  id_token: 'id-token-value',
  token_type: 'bearer',
  expires_in: 3600,
};

test('valid sign-in returns a payload containing accessToken and mustChangePassword false by default', async () => {
  const { authentik, signInCalls } = makeMockAuthentik({
    signInImpl: async () => VALID_TOKEN_RESPONSE,
  });
  const useCase = new SignInUseCase({ authentik });

  const result = await useCase.execute({ email: 'user@example.com', password: 'correct-password' });

  expect(result).toEqual(
    expect.objectContaining({
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
      idToken: 'id-token-value',
      mustChangePassword: false,
    }),
  );
  expect(signInCalls).toEqual([{ username: 'user@example.com', password: 'correct-password' }]);
});

test('returns mustChangePassword true when the Authentik user has that attribute set', async () => {
  const { authentik } = makeMockAuthentik({
    signInImpl: async () => VALID_TOKEN_RESPONSE,
    getUserImpl: async (username) => ({
      pk: 1,
      username,
      email: username,
      attributes: { mustChangePassword: true },
    }),
  });
  const useCase = new SignInUseCase({ authentik });

  const result = await useCase.execute({ email: 'user@example.com', password: 'correct-password' });

  expect(result.mustChangePassword).toBe(true);
});

test('looks up the signed-in user by the email that was used to sign in', async () => {
  const { authentik, getUserCalls } = makeMockAuthentik({
    signInImpl: async () => VALID_TOKEN_RESPONSE,
  });
  const useCase = new SignInUseCase({ authentik });

  await useCase.execute({ email: 'user@example.com', password: 'correct-password' });

  expect(getUserCalls).toEqual(['user@example.com']);
});

test('incorrect password throws a GraphQLError with an UNAUTHENTICATED extensions.code', async () => {
  const { authentik } = makeMockAuthentik({
    signInImpl: async () => {
      throw new AuthentikApiError(400, { component: 'ak-stage-password', response_errors: {} });
    },
  });
  const useCase = new SignInUseCase({ authentik });

  await expect(
    useCase.execute({ email: 'user@example.com', password: 'wrong-password' }),
  ).rejects.toMatchObject({
    extensions: { code: 'UNAUTHENTICATED' },
  });
});

test('non-existent email throws the exact same UNAUTHENTICATED error as incorrect password (anti-enumeration)', async () => {
  const wrongPasswordDouble = makeMockAuthentik({
    signInImpl: async () => {
      throw new AuthentikApiError(400, { component: 'ak-stage-password', response_errors: {} });
    },
  });
  const nonExistentEmailDouble = makeMockAuthentik({
    signInImpl: async () => {
      throw new AuthentikApiError(400, { component: 'ak-stage-identification', response_errors: {} });
    },
  });

  const wrongPasswordError: GraphQLError = await new SignInUseCase({
    authentik: wrongPasswordDouble.authentik,
  })
    .execute({ email: 'user@example.com', password: 'wrong-password' })
    .catch((error) => error);

  const nonExistentEmailError: GraphQLError = await new SignInUseCase({
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
  expect(nonExistentEmailError.extensions.code).toBe('UNAUTHENTICATED');
});

test('authentik unreachable throws a generic GraphQLError, not UNAUTHENTICATED', async () => {
  const { authentik } = makeMockAuthentik({
    signInImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  const useCase = new SignInUseCase({ authentik });

  const error: GraphQLError = await useCase
    .execute({ email: 'user@example.com', password: 'whatever' })
    .catch((error) => error);

  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions.code).not.toBe('UNAUTHENTICATED');
  // Must not leak the raw transport error message to the client.
  expect(error.message).not.toContain('fetch failed');
});

test('an unexpected Authentik response shape throws a generic server error, not a raw leak of the response', async () => {
  const malformedResponse = {
    weird_internal_field: 'super-secret-authentik-internal-detail',
    // no access_token/refresh_token/id_token at all
  };
  const { authentik } = makeMockAuthentik({ signInImpl: async () => malformedResponse });
  const useCase = new SignInUseCase({ authentik });

  const error: GraphQLError = await useCase
    .execute({ email: 'user@example.com', password: 'correct-password' })
    .catch((error) => error);

  expect(error).toBeInstanceOf(GraphQLError);
  expect(error.extensions.code).not.toBe('UNAUTHENTICATED');
  expect(error.message).not.toContain('weird_internal_field');
  expect(error.message).not.toContain('super-secret-authentik-internal-detail');
  expect(JSON.stringify(error.extensions)).not.toContain('super-secret-authentik-internal-detail');
});

test('empty email and password are rejected before calling authentik at all, with a BAD_USER_INPUT code', async () => {
  const { authentik, signInCalls } = makeMockAuthentik({ signInImpl: async () => VALID_TOKEN_RESPONSE });
  const useCase = new SignInUseCase({ authentik });

  await expect(useCase.execute({ email: '', password: '' })).rejects.toMatchObject({
    extensions: { code: 'BAD_USER_INPUT' },
  });

  expect(signInCalls).toHaveLength(0);
});
