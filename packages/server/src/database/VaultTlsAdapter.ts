import { vaultAppRoleLogin, vaultFetch } from './vaultClient';

export interface TlsConfig {
  ca: Buffer;
  cert: Buffer;
  key: Buffer;
}

interface VaultPkiIssueResponse {
  data: { certificate: string; private_key: string; issuing_ca: string };
}

export interface VaultTlsAdapterConfig {
  vaultAddr?: string;
  roleId?: string;
  secretId?: string;
  tlsRole?: string;
  commonName?: string;
}

/**
 * Fetches a short-lived TLS leaf cert from Vault's PKI secrets engine (via AppRole login).
 * Consumed by GrpcDriver/
 * ApolloDriver's `tls` config for mTLS. See services/vault/CLAUDE.md for the provisioning story
 * (services/vault/ansible/roles/provision-server-vault) a server's role_id/secret_id/tlsRole come
 * from.
 *
 * Known gap: the returned cert expires at its Vault lease TTL (default 1h, configured in
 * services/vault/ansible's pki_int/roles/<name>-tls-role) — nothing renews it, a long-running
 * server must restart to get a fresh one.
 */
export class VaultTlsAdapter {
  /**
   * Logs into Vault via AppRole, issues a fresh `pki_int/issue/<tlsRole>` cert, and returns it as
   * a `TlsConfig`. Throws if required config/env vars are missing.
   */
  static async fromEnv(config: VaultTlsAdapterConfig = {}): Promise<TlsConfig> {
    const vaultAddr =
      config.vaultAddr ?? process.env.VAULT_ADDR ?? 'http://localhost:8200';
    const roleId = config.roleId ?? process.env.VAULT_ROLE_ID;
    const secretId = config.secretId ?? process.env.VAULT_SECRET_ID;
    const tlsRole = config.tlsRole ?? process.env.VAULT_TLS_ROLE;
    const commonName = config.commonName ?? tlsRole?.replace(/-tls-role$/, '');

    if (!roleId || !secretId || !tlsRole || !commonName) {
      throw new Error(
        'VaultTlsAdapter.fromEnv() requires VAULT_ROLE_ID, VAULT_SECRET_ID, VAULT_TLS_ROLE (or the matching config fields)',
      );
    }

    const token = await vaultAppRoleLogin(vaultAddr, roleId, secretId);

    const { data } = await vaultFetch<VaultPkiIssueResponse>(
      vaultAddr,
      'POST',
      `pki_int/issue/${tlsRole}`,
      { common_name: commonName },
      token,
    );

    return {
      ca: Buffer.from(data.issuing_ca),
      cert: Buffer.from(data.certificate),
      key: Buffer.from(data.private_key),
    };
  }
}
