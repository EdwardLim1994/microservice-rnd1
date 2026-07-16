import { PgAdapter } from './PgAdapter';

interface VaultLoginResponse {
  auth: { client_token: string };
}

interface VaultDbCredsResponse {
  data: { username: string; password: string };
}

async function vaultFetch<T>(
  vaultAddr: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`${vaultAddr.replace(/\/$/, '')}/v1/${path}`, {
    method,
    headers: token ? { 'X-Vault-Token': token } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(
      `Vault request failed: ${method} ${path} -> ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

export interface VaultPgAdapterConfig {
  vaultAddr?: string;
  roleId?: string;
  secretId?: string;
  dbRole?: string;
  dbHost?: string;
  dbPort?: string;
  dbName?: string;
}

/**
 * Fetches a short-lived Postgres credential from Vault's database secrets engine (via AppRole
 * login) and builds a PgAdapter from it. This is the generated default for a new server's
 * .database() call — see turbo/generators/serverExtension/DatabaseGenerator.ts and
 * services/vault/CLAUDE.md for the provisioning story a server's role_id/secret_id come from.
 *
 * Known gap: the returned PgAdapter's credential expires at its Vault lease TTL (default 1h,
 * configured in services/vault/ansible's database/roles/<name>-role). Nothing renews it — a
 * long-running server must restart to get a fresh lease. Accepted as out of scope for this
 * prototype; see packages/server/CLAUDE.md's Database section.
 */
export class VaultPgAdapter {
  /**
   * Logs into Vault via AppRole, reads a fresh `database/creds/<dbRole>` credential, and builds a
   * `PgAdapter` from it. Throws if required config/env vars are missing. The returned adapter's
   * credential expires at its Vault lease TTL — nothing renews it (see class-level comment).
   */
  static async fromEnv(config: VaultPgAdapterConfig = {}): Promise<PgAdapter> {
    const vaultAddr =
      config.vaultAddr ?? process.env.VAULT_ADDR ?? 'http://localhost:8200';
    const roleId = config.roleId ?? process.env.VAULT_ROLE_ID;
    const secretId = config.secretId ?? process.env.VAULT_SECRET_ID;
    const dbRole = config.dbRole ?? process.env.VAULT_DB_ROLE;
    const dbHost = config.dbHost ?? process.env.DB_HOST ?? 'localhost';
    const dbPort = config.dbPort ?? process.env.DB_PORT ?? '5432';
    const dbName = config.dbName ?? process.env.DB_NAME;

    if (!roleId || !secretId || !dbRole || !dbName) {
      throw new Error(
        'VaultPgAdapter.fromEnv() requires VAULT_ROLE_ID, VAULT_SECRET_ID, VAULT_DB_ROLE and DB_NAME (or the matching config fields)',
      );
    }

    const { auth } = await vaultFetch<VaultLoginResponse>(
      vaultAddr,
      'POST',
      'auth/approle/login',
      { role_id: roleId, secret_id: secretId },
    );

    const { data } = await vaultFetch<VaultDbCredsResponse>(
      vaultAddr,
      'GET',
      `database/creds/${dbRole}`,
      undefined,
      auth.client_token,
    );

    const connectionString = `postgresql://${encodeURIComponent(data.username)}:${encodeURIComponent(data.password)}@${dbHost}:${dbPort}/${dbName}`;
    return new PgAdapter(connectionString);
  }
}
