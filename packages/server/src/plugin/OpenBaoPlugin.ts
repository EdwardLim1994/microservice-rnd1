import { readFile } from 'node:fs/promises';
import { type AwilixContainer, asValue } from 'awilix';
import { BasePlugin } from '../abstract/BasePlugin';

const SERVICE_ACCOUNT_TOKEN_PATH =
  '/var/run/secrets/kubernetes.io/serviceaccount/token';

/**
 * Thrown on any non-2xx response, carrying the status + parsed body — same pattern as
 * AuthentikApiError.
 */
export class OpenBaoApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`OpenBao API error ${status}`);
  }
}

export interface OpenBaoClientConfig {
  baseUrl?: string;
  role?: string;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return text;
  }
}

/**
 * Plain fetch-based thin client, not a generated SDK — same convention as AuthentikClient. KV v2
 * only ("secret/" mount, see services/openbao/helm/files/k8s-auth-provision.sh) — app-level
 * secrets (API keys, JWT signing keys, third-party creds) for this server's own use, never
 * DB/Redis credentials (those stay static Terraform-managed passwords, see
 * services/terraform/variables.tf's authentik_postgres_password and apps/terraform's own
 * random_password.db/redis).
 *
 * Kubernetes auth, not a static token: login() reads this pod's own already-mounted
 * ServiceAccount token (kubelet-refreshed, never a stale snapshot) and exchanges it for a
 * short-lived OpenBao client token — no credential to configure at all beyond OPENBAO_ADDR/
 * OPENBAO_ROLE. The server-side templated policy
 * (secret/data/servers/{{identity.entity.aliases.<accessor>.metadata.service_account_name}}/*)
 * scopes every server to only its own path automatically, keyed off this pod's own
 * ServiceAccount name — see the turbo/generators "secrets" extension for how that ServiceAccount
 * gets created per server.
 */
export class OpenBaoClient {
  private readonly baseUrl: string;
  private readonly role: string;
  private token?: string;

  /** Resolves config from args or env vars; throws if any required value is missing. */
  constructor(config: OpenBaoClientConfig = {}) {
    const baseUrl = config.baseUrl ?? process.env.OPENBAO_ADDR;
    const role = config.role ?? process.env.OPENBAO_ROLE;

    if (!baseUrl || !role) {
      throw new Error(
        'OpenBaoClient requires OPENBAO_ADDR and OPENBAO_ROLE (or the matching config fields)',
      );
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.role = role;
  }

  /** Exchanges this pod's own ServiceAccount token for an OpenBao client token via the kubernetes auth method. */
  async login(): Promise<void> {
    const jwt = (await readFile(SERVICE_ACCOUNT_TOKEN_PATH, 'utf-8')).trim();
    const response = await fetch(`${this.baseUrl}/v1/auth/kubernetes/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: this.role, jwt }),
    });
    if (!response.ok) {
      throw new OpenBaoApiError(response.status, await parseBody(response));
    }
    const body = (await response.json()) as {
      auth?: { client_token?: string };
    };
    const clientToken = body.auth?.client_token;
    if (!clientToken) {
      throw new OpenBaoApiError(response.status, body);
    }
    this.token = clientToken;
  }

  /** Reads a KV v2 secret at `secret/data/servers/<own-name>/<path>`, or undefined if it doesn't exist yet. */
  async get(path: string): Promise<Record<string, unknown> | undefined> {
    const response = await fetch(`${this.baseUrl}/v1/secret/data/${path}`, {
      headers: this.authHeaders(),
    });
    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new OpenBaoApiError(response.status, await parseBody(response));
    }
    const body = (await response.json()) as {
      data?: { data?: Record<string, unknown> };
    };
    return body.data?.data;
  }

  /** Writes a KV v2 secret at `secret/data/servers/<own-name>/<path>`. */
  async put(path: string, data: Record<string, unknown>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/secret/data/${path}`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    if (!response.ok) {
      throw new OpenBaoApiError(response.status, await parseBody(response));
    }
  }

  private authHeaders(): Record<string, string> {
    if (!this.token) {
      throw new Error('OpenBaoClient.login() must succeed before get()/put()');
    }
    return { 'X-Vault-Token': this.token };
  }
}

export class OpenBaoPlugin extends BasePlugin {
  private client?: OpenBaoClient;

  /** factory param allows injection in tests without touching the real client, same pattern as RedisPlugin/AuthentikPlugin */
  constructor(
    private readonly container: AwilixContainer,
    private readonly createClient: () => OpenBaoClient = () =>
      new OpenBaoClient(),
  ) {
    super();
  }

  /** Authenticates via Kubernetes auth, failing server startup on a bad role/unreachable OpenBao instead of surfacing later — then registers `secrets` into the container. */
  async onStart(): Promise<void> {
    this.client = this.createClient();
    await this.client.login();
    this.container.register({ secrets: asValue(this.client) });
  }

  /** No-op — stateless HTTP client, nothing to close, same as MinioPlugin/AuthentikPlugin. */
  async onStop(): Promise<void> {}
}
