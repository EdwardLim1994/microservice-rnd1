import { expect, test } from '@rstest/core';
import { createContainer, InjectionMode } from 'awilix';
import {
  AuthentikApiError,
  AuthentikClient,
  AuthentikPlugin,
} from '../../src/plugin/AuthentikPlugin';

// AuthentikClient calls the global `fetch` directly (no injection point, same as the framework's
// other thin HTTP clients) — so exercising its own logic (not just AuthentikPlugin's wiring, the
// way RedisPlugin.test.ts/MeilisearchPlugin.test.ts test their sibling plugins) needs a manual
// stand-in for `fetch` itself. This is a plain function swap for the duration of one test, not
// module mocking (`vi` is unavailable — see packages/server/CLAUDE.md's Testing section) — same
// "manual test double" spirit, just applied to a global instead of an injected dependency.
function withMockFetch<T>(
  responses: Response[] | ((call: number) => Response),
  run: () => Promise<T>,
) {
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    const response = Array.isArray(responses)
      ? responses[call]
      : responses(call);
    call++;
    if (!response)
      throw new Error(`withMockFetch: no response configured for call ${call}`);
    return response;
  }) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

function jsonResponse(
  status: number,
  body: unknown,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), { status, headers });
}

const CONFIG = {
  baseUrl: 'https://authentik.test',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  apiToken: 'api-token',
};

function makeContainer() {
  return createContainer({ injectionMode: InjectionMode.PROXY });
}

// --- AuthentikClient construction -----------------------------------------------------------

test('constructor throws when required config is missing', () => {
  expect(() => new AuthentikClient({})).toThrow(/requires AUTHENTIK_URL/);
});

test('constructor accepts explicit config over env vars', () => {
  expect(() => new AuthentikClient(CONFIG)).not.toThrow();
});

// --- healthCheck() ----------------------------------------------------------------------------

test('healthCheck() resolves on a 2xx response', async () => {
  const client = new AuthentikClient(CONFIG);
  await withMockFetch([new Response(null, { status: 200 })], () =>
    client.healthCheck(),
  );
});

test('healthCheck() throws AuthentikApiError on a non-2xx response', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch([jsonResponse(503, { detail: 'unavailable' })], () =>
      client.healthCheck(),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

// --- createUser() / enroll() --------------------------------------------------------------------

test('createUser() creates the user then sets the password', async () => {
  const client = new AuthentikClient(CONFIG);
  const result = await withMockFetch(
    [
      jsonResponse(201, { pk: 1, username: 'jane', email: 'jane@example.com' }),
      jsonResponse(200, {}),
    ],
    () =>
      client.createUser({
        username: 'jane',
        email: 'jane@example.com',
        password: 'pw',
      }),
  );
  expect(result).toEqual({
    pk: 1,
    username: 'jane',
    email: 'jane@example.com',
  });
});

test('createUser() throws AuthentikApiError when user creation fails', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch(
      [jsonResponse(400, { username: [{ string: 'taken' }] })],
      () =>
        client.createUser({
          username: 'jane',
          email: 'jane@example.com',
          password: 'pw',
        }),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('createUser() throws AuthentikApiError when set_password fails after user creation', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch(
      [
        jsonResponse(201, {
          pk: 1,
          username: 'jane',
          email: 'jane@example.com',
        }),
        jsonResponse(400, {}),
      ],
      () =>
        client.createUser({
          username: 'jane',
          email: 'jane@example.com',
          password: 'pw',
        }),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('enroll() delegates to createUser() using the email as the username', async () => {
  const client = new AuthentikClient(CONFIG);
  const result = await withMockFetch(
    [
      jsonResponse(201, {
        pk: 2,
        username: 'jane@example.com',
        email: 'jane@example.com',
      }),
      jsonResponse(200, {}),
    ],
    () => client.enroll('jane@example.com', 'pw'),
  );
  expect(result.username).toBe('jane@example.com');
});

// --- revokeToken() ----------------------------------------------------------------------------

test('revokeToken() resolves on a 2xx response', async () => {
  const client = new AuthentikClient(CONFIG);
  await withMockFetch([new Response(null, { status: 200 })], () =>
    client.revokeToken('a-refresh-token', 'refresh_token'),
  );
});

test('revokeToken() throws AuthentikApiError on a non-2xx response', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch([jsonResponse(500, {})], () => client.revokeToken('a-token')),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

// --- signIn() — the full Flow Executor + Authorization Code sequence --------------------------

test('signIn() drives the full flow and returns the token response', async () => {
  const client = new AuthentikClient(CONFIG);
  const result = await withMockFetch(
    [
      jsonResponse(200, { component: 'ak-stage-identification' }), // GET flow start
      jsonResponse(200, { component: 'ak-stage-password' }), // POST uid_field
      jsonResponse(200, { component: 'xak-flow-redirect' }), // POST password -> already redirects
      new Response(null, {
        status: 302,
        headers: { location: 'https://authentik.test/callback?code=auth-code' },
      }), // GET authorize
      jsonResponse(200, {
        access_token: 'access',
        refresh_token: 'refresh',
        id_token: 'id',
        token_type: 'Bearer',
        expires_in: 300,
        scope: 'openid',
      }), // POST token
    ],
    () => client.signIn('jane', 'correct-password'),
  );
  expect(result.access_token).toBe('access');
});

test('signIn() throws when the flow does not start at the identification stage', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch([jsonResponse(200, { component: 'unexpected-stage' })], () =>
      client.signIn('jane', 'pw'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('signIn() throws on an unknown username (flow does not advance to the password stage)', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch(
      [
        jsonResponse(200, { component: 'ak-stage-identification' }),
        jsonResponse(200, { component: 'ak-stage-identification' }),
      ],
      () => client.signIn('unknown-user', 'pw'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('signIn() throws on a wrong password (stage re-renders itself)', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch(
      [
        jsonResponse(200, { component: 'ak-stage-identification' }),
        jsonResponse(200, { component: 'ak-stage-password' }),
        jsonResponse(200, {
          component: 'ak-stage-password',
          response_errors: {},
        }),
      ],
      () => client.signIn('jane', 'wrong-password'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('signIn() polls skippable stages via GET before reaching the redirect', async () => {
  const client = new AuthentikClient(CONFIG);
  const result = await withMockFetch(
    [
      jsonResponse(200, { component: 'ak-stage-identification' }),
      jsonResponse(200, { component: 'ak-stage-password' }),
      jsonResponse(200, { component: 'ak-stage-authenticator-validate' }), // POST password
      jsonResponse(200, { component: 'xak-flow-redirect' }), // GET re-poll
      new Response(null, {
        status: 302,
        headers: { location: 'https://authentik.test/callback?code=auth-code' },
      }),
      jsonResponse(200, {
        access_token: 'access',
        token_type: 'Bearer',
        expires_in: 300,
        scope: 'openid',
      }),
    ],
    () => client.signIn('jane', 'correct-password'),
  );
  expect(result.access_token).toBe('access');
});

test('signIn() throws if the authorize step does not return a redirect', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch(
      [
        jsonResponse(200, { component: 'ak-stage-identification' }),
        jsonResponse(200, { component: 'ak-stage-password' }),
        jsonResponse(200, { component: 'xak-flow-redirect' }),
        jsonResponse(400, {}),
      ],
      () => client.signIn('jane', 'correct-password'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('signIn() throws if the redirect has no authorization code', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch(
      [
        jsonResponse(200, { component: 'ak-stage-identification' }),
        jsonResponse(200, { component: 'ak-stage-password' }),
        jsonResponse(200, { component: 'xak-flow-redirect' }),
        new Response(null, {
          status: 302,
          headers: { location: 'https://authentik.test/callback' },
        }),
      ],
      () => client.signIn('jane', 'correct-password'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('signIn() throws if the final token exchange fails', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch(
      [
        jsonResponse(200, { component: 'ak-stage-identification' }),
        jsonResponse(200, { component: 'ak-stage-password' }),
        jsonResponse(200, { component: 'xak-flow-redirect' }),
        new Response(null, {
          status: 302,
          headers: {
            location: 'https://authentik.test/callback?code=auth-code',
          },
        }),
        jsonResponse(400, { error: 'invalid_grant' }),
      ],
      () => client.signIn('jane', 'correct-password'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

// --- logout() -------------------------------------------------------------------------------

test('logout() introspects, revokes, and terminates the user session on an active token', async () => {
  const client = new AuthentikClient(CONFIG);
  const fetchCalls: string[] = [];
  await withMockFetch(
    (call) => {
      const responses = [
        jsonResponse(200, { active: true, sub: 'user-1' }), // introspect
        new Response(null, { status: 200 }), // revoke
        jsonResponse(200, { results: [{ uuid: 'session-1' }] }), // list sessions
        new Response(null, { status: 204 }), // delete session
      ];
      fetchCalls.push(`call-${call}`);
      return responses[call] as Response;
    },
    () => client.logout('a-valid-access-token'),
  );
  expect(fetchCalls.length).toBe(4);
});

test('logout() throws AuthentikApiError without revoking when the token is already inactive', async () => {
  const client = new AuthentikClient(CONFIG);
  let fetchCallCount = 0;
  await expect(
    withMockFetch(
      () => {
        fetchCallCount++;
        return jsonResponse(200, { active: false });
      },
      () => client.logout('an-expired-access-token'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
  // Only the introspection call — revoke() must never run for an already-inactive token.
  expect(fetchCallCount).toBe(1);
});

test('logout() throws AuthentikApiError when introspection itself fails', async () => {
  const client = new AuthentikClient(CONFIG);
  await expect(
    withMockFetch([jsonResponse(503, { detail: 'unavailable' })], () =>
      client.logout('a-token'),
    ),
  ).rejects.toBeInstanceOf(AuthentikApiError);
});

test('logout() does not throw when best-effort session termination fails', async () => {
  const client = new AuthentikClient(CONFIG);
  await withMockFetch(
    [
      jsonResponse(200, { active: true, sub: 'user-1' }), // introspect
      new Response(null, { status: 200 }), // revoke
      jsonResponse(403, { detail: 'forbidden' }), // list sessions — RBAC not granted
    ],
    () => client.logout('a-valid-access-token'),
  );
});

// --- AuthentikPlugin ----------------------------------------------------------------------------

test('AuthentikPlugin.onStart() calls healthCheck() and registers the client', async () => {
  const container = makeContainer();
  const calls: string[] = [];
  const mockClient = {
    healthCheck: async () => {
      calls.push('healthCheck');
    },
  } as unknown as AuthentikClient;
  const plugin = new AuthentikPlugin(container, () => mockClient);

  await plugin.onStart();

  expect(calls).toEqual(['healthCheck']);
  expect(container.resolve('authentik')).toBe(mockClient);
});

test('AuthentikPlugin.onStop() resolves without doing anything', async () => {
  const container = makeContainer();
  const plugin = new AuthentikPlugin(container, () => ({}) as AuthentikClient);

  await expect(plugin.onStop()).resolves.toBeUndefined();
});
