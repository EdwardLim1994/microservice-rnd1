import { PrismaPg } from '@prisma/adapter-pg';
import { afterEach, beforeEach, expect, test } from '@rstest/core';
import { VaultPgAdapter } from '../../src/database/VaultPgAdapter';

const originalFetch = globalThis.fetch;

function mockVaultFetch() {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    calls.push({ url, init });

    if (url.endsWith('/v1/auth/approle/login')) {
      return new Response(
        JSON.stringify({ auth: { client_token: 'test-client-token' } }),
        { status: 200 },
      );
    }

    if (url.includes('/v1/database/creds/')) {
      return new Response(
        JSON.stringify({
          data: { username: 'dyn-user', password: 'dyn-pass' },
        }),
        { status: 200 },
      );
    }

    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  process.env.VAULT_ADDR = 'http://localhost:8200';
  process.env.VAULT_ROLE_ID = 'role-id';
  process.env.VAULT_SECRET_ID = 'secret-id';
  process.env.VAULT_DB_ROLE = 'test1-role';
  process.env.DB_HOST = 'test1-db';
  process.env.DB_PORT = '5432';
  process.env.DB_NAME = 'test1';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of [
    'VAULT_ADDR',
    'VAULT_ROLE_ID',
    'VAULT_SECRET_ID',
    'VAULT_DB_ROLE',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
  ]) {
    delete process.env[key];
  }
});

test('fromEnv() logs in via AppRole, fetches dynamic creds, and returns a PgAdapter', async () => {
  const calls = mockVaultFetch();

  const adapter = await VaultPgAdapter.fromEnv();

  expect(adapter.adapter).toBeInstanceOf(PrismaPg);
  expect(calls[0].url).toBe('http://localhost:8200/v1/auth/approle/login');
  expect(JSON.parse(calls[0].init?.body as string)).toEqual({
    role_id: 'role-id',
    secret_id: 'secret-id',
  });
  expect(calls[1].url).toBe(
    'http://localhost:8200/v1/database/creds/test1-role',
  );
  expect(calls[1].init?.headers).toMatchObject({
    'X-Vault-Token': 'test-client-token',
  });
});

test('fromEnv() throws if required config is missing', async () => {
  delete process.env.VAULT_ROLE_ID;
  mockVaultFetch();

  await expect(VaultPgAdapter.fromEnv()).rejects.toThrow(
    'VaultPgAdapter.fromEnv() requires',
  );
});

test('fromEnv() throws when Vault responds with an error status', async () => {
  globalThis.fetch = (async () =>
    new Response('permission denied', { status: 403 })) as typeof fetch;

  await expect(VaultPgAdapter.fromEnv()).rejects.toThrow(
    'Vault request failed',
  );
});

test('fromEnv() accepts explicit config overriding env vars', async () => {
  const calls = mockVaultFetch();

  await VaultPgAdapter.fromEnv({
    vaultAddr: 'http://vault:8200',
    roleId: 'other-role-id',
    secretId: 'other-secret-id',
    dbRole: 'other-role',
    dbHost: 'other-host',
    dbPort: '5433',
    dbName: 'other-db',
  });

  expect(calls[0].url).toBe('http://vault:8200/v1/auth/approle/login');
  expect(calls[1].url).toBe('http://vault:8200/v1/database/creds/other-role');
});
