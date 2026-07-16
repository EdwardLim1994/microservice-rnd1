export interface VaultLoginResponse {
  auth: { client_token: string };
}

/** Raw Vault HTTP API call — shared by VaultPgAdapter and VaultTlsAdapter. */
export async function vaultFetch<T>(
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

/** Logs into Vault via AppRole, returning the resulting client token. */
export async function vaultAppRoleLogin(
  vaultAddr: string,
  roleId: string,
  secretId: string,
): Promise<string> {
  const { auth } = await vaultFetch<VaultLoginResponse>(
    vaultAddr,
    'POST',
    'auth/approle/login',
    { role_id: roleId, secret_id: secretId },
  );
  return auth.client_token;
}
