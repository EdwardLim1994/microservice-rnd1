import { expect, test } from '@rstest/core';
import { GraphQLError } from 'graphql';
import { AuthentikApiError, type AuthentikClient } from 'server';
// Not implemented yet — this import is expected to fail to resolve until FEAT-01 adds
// servers/auth/src/usecases/RegisterUseCase.ts. That failure is correct/expected: these are
// TDD-style integration tests written ahead of the implementation (see issue #17).
import RegisterUseCase from '../../src/usecases/RegisterUseCase';

// RegisterUseCase is expected to drive authentik's real enrollment flow (Flow Executor API) rather
// than the Admin API createUser() SignUpUseCase uses — see issue #17 and servers/auth/CLAUDE.md's
// "Known v1 limitations" section on why signUp bypassed it. AuthentikClient has no such method
// yet (AuthentikPlugin.ts's current methods are healthCheck/signIn/revokeToken/createUser); FEAT-01's
// implementer needs to add whatever enrollment-flow method register() actually calls. Rather than
// guess AuthentikClient's exact real shape, the mock below is a bare plain object exposing only a
// single `enroll(email, password)` method — camelCase-verb naming matching the class's existing
// method style (signIn/revokeToken/createUser) — cast to AuthentikClient. If the implementer names
// the method differently, this mock (and RegisterUseCase's constructor destructure) is the one spot
// that needs updating to match.

interface MockAuthentik {
  authentik: AuthentikClient;
  callCount: () => number;
  lastCall: () => { email: string; password: string } | undefined;
}

function createMockAuthentik(
  enrollImpl: (email: string, password: string) => Promise<unknown>,
): MockAuthentik {
  let calls = 0;
  let last: { email: string; password: string } | undefined;

  const authentik = {
    async enroll(email: string, password: string) {
      calls++;
      last = { email, password };
      return enrollImpl(email, password);
    },
  };

  return {
    authentik: authentik as unknown as AuthentikClient,
    callCount: () => calls,
    lastCall: () => last,
  };
}

function getGraphQLError(thrown: unknown): GraphQLError {
  expect(thrown).toBeInstanceOf(GraphQLError);
  return thrown as GraphQLError;
}

// --- Valid registration -----------------------------------------------------------------------

test('valid registration returns success: true', async () => {
  const { authentik } = createMockAuthentik(async () => ({
    pk: 1,
    username: 'jane.doe',
    email: 'jane.doe@example.com',
  }));
  const useCase = new RegisterUseCase({ authentik });

  const result = await useCase.execute({
    email: 'jane.doe@example.com',
    password: 'Correct-Horse-Battery-Staple-1!',
  });

  expect(result.success).toBe(true);
});

test('valid registration calls authentik enrollment with the submitted credentials', async () => {
  const { authentik, callCount, lastCall } = createMockAuthentik(async () => ({
    pk: 1,
    username: 'jane.doe',
    email: 'jane.doe@example.com',
  }));
  const useCase = new RegisterUseCase({ authentik });

  await useCase.execute({
    email: 'jane.doe@example.com',
    password: 'Correct-Horse-Battery-Staple-1!',
  });

  expect(callCount()).toBe(1);
  expect(lastCall()).toEqual({
    email: 'jane.doe@example.com',
    password: 'Correct-Horse-Battery-Staple-1!',
  });
});

// --- Duplicate email ---------------------------------------------------------------------------

test('duplicate email throws a GraphQLError with a duplicate-email-flavored code', async () => {
  const { authentik } = createMockAuthentik(async () => {
    // DRF-style field-errors dict, same shape SignUpUseCase's looksLikeDuplicateUsername comment
    // documents for the equivalent username-uniqueness case — confirmed live against Authentik
    // 2026.5.4 for a create-time uniqueness violation.
    throw new AuthentikApiError(400, {
      response_errors: {
        email: [{ string: 'A user with that email already exists.', code: 'unique' }],
      },
    });
  });
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: 'duplicate@example.com', password: 'Correct-Horse-1!' });
  } catch (error) {
    thrown = error;
  }

  const error = getGraphQLError(thrown);
  expect(String(error.extensions?.code)).toMatch(/duplicate|taken|exists/i);
  expect(String(error.extensions?.code)).toMatch(/email/i);
});

// --- Authentik unreachable -----------------------------------------------------------------------

test('authentik being unreachable throws a GraphQLError with a service-unavailable-flavored code', async () => {
  const { authentik } = createMockAuthentik(async () => {
    throw new AuthentikApiError(503, { detail: 'Service Unavailable' });
  });
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: 'jane.doe@example.com', password: 'Correct-Horse-1!' });
  } catch (error) {
    thrown = error;
  }

  const error = getGraphQLError(thrown);
  expect(String(error.extensions?.code)).toMatch(/unavailable|unreachable/i);
});

test('a network-level failure (not even an HTTP response) is also surfaced as service-unavailable', async () => {
  const { authentik } = createMockAuthentik(async () => {
    throw new TypeError('fetch failed');
  });
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: 'jane.doe@example.com', password: 'Correct-Horse-1!' });
  } catch (error) {
    thrown = error;
  }

  const error = getGraphQLError(thrown);
  expect(String(error.extensions?.code)).toMatch(/unavailable|unreachable/i);
});

// --- Password policy violation ------------------------------------------------------------------

test("a password policy violation surfaces authentik's own policy error message", async () => {
  const policyMessage = 'This password is too common.';
  const { authentik } = createMockAuthentik(async () => {
    // Flow Executor stage-challenge shape — same "re-render the stage with response_errors"
    // pattern AuthentikClient.runAuthenticationFlow's wrong-password branch documents for
    // ak-stage-password, just for the enrollment flow's password stage instead.
    throw new AuthentikApiError(400, {
      component: 'ak-stage-password',
      response_errors: {
        password: [{ string: policyMessage, code: 'password_too_common' }],
      },
    });
  });
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: 'jane.doe@example.com', password: 'password' });
  } catch (error) {
    thrown = error;
  }

  const error = getGraphQLError(thrown);
  expect(error.message).toContain(policyMessage);
});

// --- Empty / malformed input rejected before calling authentik ---------------------------------

test('empty email is rejected before authentik is called', async () => {
  const { authentik, callCount } = createMockAuthentik(async () => ({
    pk: 1,
    username: 'x',
    email: 'x',
  }));
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: '', password: 'Correct-Horse-1!' });
  } catch (error) {
    thrown = error;
  }

  getGraphQLError(thrown);
  expect(callCount()).toBe(0);
});

test('empty password is rejected before authentik is called', async () => {
  const { authentik, callCount } = createMockAuthentik(async () => ({
    pk: 1,
    username: 'x',
    email: 'x',
  }));
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: 'jane.doe@example.com', password: '' });
  } catch (error) {
    thrown = error;
  }

  getGraphQLError(thrown);
  expect(callCount()).toBe(0);
});

test('malformed email (no @) is rejected before authentik is called', async () => {
  const { authentik, callCount } = createMockAuthentik(async () => ({
    pk: 1,
    username: 'x',
    email: 'x',
  }));
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: 'not-an-email', password: 'Correct-Horse-1!' });
  } catch (error) {
    thrown = error;
  }

  getGraphQLError(thrown);
  expect(callCount()).toBe(0);
});

test('whitespace-only email is rejected before authentik is called', async () => {
  const { authentik, callCount } = createMockAuthentik(async () => ({
    pk: 1,
    username: 'x',
    email: 'x',
  }));
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: '   ', password: 'Correct-Horse-1!' });
  } catch (error) {
    thrown = error;
  }

  getGraphQLError(thrown);
  expect(callCount()).toBe(0);
});

test('whitespace-only password is rejected before authentik is called', async () => {
  const { authentik, callCount } = createMockAuthentik(async () => ({
    pk: 1,
    username: 'x',
    email: 'x',
  }));
  const useCase = new RegisterUseCase({ authentik });

  let thrown: unknown;
  try {
    await useCase.execute({ email: 'jane.doe@example.com', password: '   ' });
  } catch (error) {
    thrown = error;
  }

  getGraphQLError(thrown);
  expect(callCount()).toBe(0);
});
