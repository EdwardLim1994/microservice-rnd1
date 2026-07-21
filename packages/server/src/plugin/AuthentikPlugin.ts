import { type AwilixContainer, asValue } from 'awilix';
import { BasePlugin } from '../abstract/BasePlugin';

/**
 * Must match exactly what services/authentik/ansible's provisioning role registers as the OAuth2
 * Provider's redirect_uris entry (strict matching_mode) — see that role's oauth2_redirect_uri
 * default. Never actually dereferenced: signIn() reads the authorization code straight off the
 * authorize endpoint's 302 Location header instead of following the redirect.
 */
const AUTHENTIK_REDIRECT_URI = 'http://auth/callback';

interface FlowExecutorChallenge {
  component: string;
  [key: string]: unknown;
}

/**
 * Bun's fetch has no implicit cookie jar across separate calls (unlike a browser) — the
 * authentication flow below needs one across several requests, so this tracks Set-Cookie values
 * by hand. Deliberately minimal: keeps whatever the server sends, no expiry/path handling, since
 * it only ever lives for the duration of one signIn() call.
 */
class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(response: Response): void {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const raw of setCookies) {
      const pair = raw.split(';', 1)[0];
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  header(): string {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
}

export interface AuthentikTokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface AuthentikCreatedUser {
  pk: number;
  username: string;
  email: string;
}

export interface AuthentikUser {
  pk: number;
  username: string;
  email: string;
  attributes?: Record<string, unknown>;
}

/**
 * Thrown on any non-2xx response, carrying the status + parsed body so a use case can branch on
 * it (e.g. 401 on bad sign-in credentials vs. a genuine 5xx) instead of catching a bare Error and
 * guessing — same rationale as VaultPgAdapter's typed response interfaces, one level further.
 */
export class AuthentikApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`Authentik API error ${status}`);
  }
}

export interface AuthentikClientConfig {
  baseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  apiToken?: string;
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
 * Plain fetch-based thin client — same convention as VaultPgAdapter's vaultFetch, not a generated
 * SDK. Three integration points: Flow Executor + Authorization Code sign-in, RFC 7009 revoke, and
 * Admin API user creation (see services/authentik/CLAUDE.md and servers/auth/CLAUDE.md for why
 * these three specifically, and why signIn() isn't a plain OAuth2 "password" grant).
 */
export class AuthentikClient {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly apiToken: string;

  /** Resolves config from args or env vars; throws if any required value is missing. */
  constructor(config: AuthentikClientConfig = {}) {
    const baseUrl = config.baseUrl ?? process.env.AUTHENTIK_URL;
    const clientId = config.clientId ?? process.env.AUTHENTIK_OAUTH_CLIENT_ID;
    const clientSecret =
      config.clientSecret ?? process.env.AUTHENTIK_OAUTH_CLIENT_SECRET;
    const apiToken = config.apiToken ?? process.env.AUTHENTIK_API_TOKEN;

    if (!baseUrl || !clientId || !clientSecret || !apiToken) {
      throw new Error(
        'AuthentikClient requires AUTHENTIK_URL, AUTHENTIK_OAUTH_CLIENT_ID, AUTHENTIK_OAUTH_CLIENT_SECRET and AUTHENTIK_API_TOKEN (or the matching config fields)',
      );
    }

    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiToken = apiToken;
  }

  /**
   * Cheap, unauthenticated reachability check — used by AuthentikPlugin.onStart() to fail server
   * startup fast on a bad AUTHENTIK_URL, same rationale as MeilisearchPlugin's eager .health().
   */
  async healthCheck(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/-/health/ready/`);
    if (!response.ok) {
      throw new AuthentikApiError(response.status, await parseBody(response));
    }
  }

  /**
   * Real username+password sign-in. NOT the OAuth2 "password" grant — Authentik implements that
   * grant as a client-credentials-style lookup against a separate "App Password" Token, not a
   * check of the account's real password, and minting that token for a user other than the caller
   * itself is hardcoded to require is_superuser (confirmed by reading
   * authentik/providers/oauth2/views/token.py and authentik/core/api/tokens.py directly inside the
   * running container) — not something a least-privilege service account can do. So this instead
   * drives the same path a browser would: the Flow Executor API validates the real password via
   * the authentication flow's stages, then a normal Authorization Code exchange mints real tokens
   * once the resulting session is authenticated. See servers/auth/CLAUDE.md for the full story.
   */
  async signIn(
    username: string,
    password: string,
  ): Promise<AuthentikTokenResponse> {
    const cookies = await this.runAuthenticationFlow(username, password);
    return this.exchangeAuthorizationCode(cookies);
  }

  /** Sends one Flow Executor request, absorbing any `Set-Cookie` into `cookies` and throwing on a non-2xx response. */
  private async flowStep(
    method: 'GET' | 'POST',
    url: string,
    body: Record<string, string> | undefined,
    cookies: CookieJar,
  ): Promise<FlowExecutorChallenge> {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Cookie: cookies.header(),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    cookies.absorb(response);
    if (!response.ok) {
      throw new AuthentikApiError(response.status, await parseBody(response));
    }
    return (await response.json()) as FlowExecutorChallenge;
  }

  /**
   * Drives default-authentication-flow's stages (identification -> password -> an authenticated
   * session) via the Flow Executor API, returning the resulting session cookies. The flow's stage
   * order/shape was confirmed empirically against the running instance, not just from docs.
   */
  private async runAuthenticationFlow(
    username: string,
    password: string,
  ): Promise<CookieJar> {
    const cookies = new CookieJar();
    const flowUrl = `${this.baseUrl}/api/v3/flows/executor/default-authentication-flow/?query=`;

    let challenge = await this.flowStep('GET', flowUrl, undefined, cookies);
    if (challenge.component !== 'ak-stage-identification') {
      throw new AuthentikApiError(400, challenge);
    }

    challenge = await this.flowStep(
      'POST',
      flowUrl,
      { uid_field: username },
      cookies,
    );
    if (challenge.component !== 'ak-stage-password') {
      // Unknown username, or the flow isn't shaped the way this client expects.
      throw new AuthentikApiError(400, challenge);
    }

    challenge = await this.flowStep('POST', flowUrl, { password }, cookies);
    if (challenge.component === 'ak-stage-password') {
      // Wrong password — Authentik re-renders the same stage with response_errors rather than
      // advancing.
      throw new AuthentikApiError(400, challenge);
    }

    // Any further stage (e.g. the default flow's Authenticator Validation Stage, bound with
    // not_configured_action: skip) only re-evaluates on a fresh GET, not by resubmitting the same
    // challenge — confirmed empirically. Bounded retries: a stage that never resolves to a
    // redirect this way (real MFA requirement, captcha, etc.) isn't supported by this headless
    // client.
    for (let i = 0; i < 5 && challenge.component !== 'xak-flow-redirect'; i++) {
      challenge = await this.flowStep('GET', flowUrl, undefined, cookies);
    }
    if (challenge.component !== 'xak-flow-redirect') {
      throw new AuthentikApiError(400, challenge);
    }

    return cookies;
  }

  /**
   * Completes the OAuth2 Authorization Code flow against the now-authenticated session — the
   * standard token-minting mechanism once a user is logged in, unrelated to the "password" grant
   * this replaced. `redirect: 'manual'` is required so fetch returns the 302 itself (with a
   * readable Location header, since this runs server-side with no browser CORS opacity) instead
   * of following it to a redirect_uri that was never meant to be reachable.
   */
  private async exchangeAuthorizationCode(
    cookies: CookieJar,
  ): Promise<AuthentikTokenResponse> {
    const authorizeUrl = new URL(`${this.baseUrl}/application/o/authorize/`);
    authorizeUrl.searchParams.set('client_id', this.clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', AUTHENTIK_REDIRECT_URI);
    // offline_access is what actually makes Authentik issue a refresh_token — required since
    // signOut() revokes that token; see the Ansible provisioning role's own scope-mappings note
    // for why this must also be bound to the Provider as a property mapping, not just requested
    // here (an unmapped scope is silently dropped, not granted).
    authorizeUrl.searchParams.set(
      'scope',
      'openid profile email offline_access',
    );
    authorizeUrl.searchParams.set('state', crypto.randomUUID());

    const authorizeResponse = await fetch(authorizeUrl, {
      redirect: 'manual',
      headers: { Cookie: cookies.header() },
    });
    const location = authorizeResponse.headers.get('location');
    if (authorizeResponse.status !== 302 || !location) {
      throw new AuthentikApiError(
        authorizeResponse.status,
        await parseBody(authorizeResponse),
      );
    }
    const code = new URL(location, this.baseUrl).searchParams.get('code');
    if (!code) {
      throw new AuthentikApiError(400, {
        error: 'no authorization code in redirect',
        location,
      });
    }

    const tokenResponse = await fetch(`${this.baseUrl}/application/o/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: AUTHENTIK_REDIRECT_URI,
      }),
    });
    if (!tokenResponse.ok) {
      throw new AuthentikApiError(
        tokenResponse.status,
        await parseBody(tokenResponse),
      );
    }
    return (await tokenResponse.json()) as AuthentikTokenResponse;
  }

  /**
   * RFC 7009 token revocation. Per spec, this endpoint returns 200 for an already-invalid token
   * too — there's no way (nor need) to distinguish "was live" from "was already dead" here, only
   * a genuine transport/5xx failure is treated as an error.
   */
  async revokeToken(
    token: string,
    tokenTypeHint?: 'access_token' | 'refresh_token',
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/application/o/revoke/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        ...(tokenTypeHint ? { token_type_hint: tokenTypeHint } : {}),
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!response.ok) {
      throw new AuthentikApiError(response.status, await parseBody(response));
    }
  }

  /**
   * RFC 7662 token introspection — needed because RFC 7009 revoke (below) always returns 200 for
   * an already-dead token, so it alone can't tell logout() "this token was already invalid",
   * which servers/auth's logout mutation must surface as a distinct error (see its CLAUDE.md).
   */
  private async introspectToken(
    token: string,
  ): Promise<{ active: boolean; sub?: string }> {
    const response = await fetch(`${this.baseUrl}/application/o/introspect/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });
    if (!response.ok) {
      throw new AuthentikApiError(response.status, await parseBody(response));
    }
    return (await response.json()) as { active: boolean; sub?: string };
  }

  /**
   * Best-effort server-side session termination via Authentik's Admin API, using the service
   * account token also used by createUser(). Failures here are logged, not thrown — the service
   * account's RBAC role only grants add_user/view_user/reset_user_password today, not session
   * management, so this is expected to no-op (403) until that role is widened; a known v1
   * limitation, not a hard dependency of logout() actually revoking the token.
   */
  private async terminateUserSessions(userPk: string): Promise<void> {
    try {
      const listResponse = await fetch(
        `${this.baseUrl}/api/v3/core/sessions/?user=${encodeURIComponent(userPk)}`,
        { headers: { Authorization: `Bearer ${this.apiToken}` } },
      );
      if (!listResponse.ok) {
        console.error(
          `AuthentikClient.terminateUserSessions: listing sessions for user ${userPk} failed with ${listResponse.status}`,
        );
        return;
      }
      const { results } = (await listResponse.json()) as {
        results: { uuid: string }[];
      };
      await Promise.all(
        results.map((session) =>
          fetch(`${this.baseUrl}/api/v3/core/sessions/${session.uuid}/`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${this.apiToken}` },
          }),
        ),
      );
    } catch (error) {
      console.error(
        `AuthentikClient.terminateUserSessions: unable to terminate sessions for user ${userPk}`,
        error,
      );
    }
  }

  /**
   * Full RP-initiated logout: unlike a plain revokeToken() call, this first introspects the
   * access token (so an already-dead token surfaces as a distinct error to the caller — see
   * introspectToken() above), then revokes it and best-effort terminates the underlying Authentik
   * session, not just the token.
   */
  async logout(accessToken: string): Promise<void> {
    const introspection = await this.introspectToken(accessToken);
    if (!introspection.active) {
      throw new AuthentikApiError(401, { error: 'invalid_token' });
    }
    await this.revokeToken(accessToken, 'access_token');
    if (introspection.sub) {
      await this.terminateUserSessions(introspection.sub);
    }
  }

  /**
   * Self-service registration by email+password — uses the email itself as Authentik's username,
   * so a duplicate-email registration attempt surfaces as the same username-uniqueness violation
   * createUser()'s callers already know how to detect. Thin wrapper over createUser(); still
   * bypasses Authentik's own enrollment-flow stages (email verification, captcha) — a known v1
   * limitation.
   */
  async enroll(email: string, password: string): Promise<AuthentikCreatedUser> {
    return this.createUser({ username: email, email, password });
  }

  /**
   * Resolves group names to Authentik group PKs (its `groups` create-time field takes PKs, not
   * names) — one lookup per name rather than a single filtered call, since Authentik's group list
   * endpoint only supports filtering by one `name` at a time.
   */
  private async resolveGroupPks(names: string[]): Promise<string[]> {
    const pks: string[] = [];
    for (const name of names) {
      const response = await fetch(
        `${this.baseUrl}/api/v3/core/groups/?name=${encodeURIComponent(name)}`,
        { headers: { Authorization: `Bearer ${this.apiToken}` } },
      );
      if (!response.ok) {
        throw new AuthentikApiError(response.status, await parseBody(response));
      }
      const { results } = (await response.json()) as {
        results: { pk: string }[];
      };
      if (results.length === 0) {
        throw new AuthentikApiError(404, {
          error: `Authentik group not found: ${name}`,
        });
      }
      pks.push(results[0].pk);
    }
    return pks;
  }

  /**
   * Admin API user creation — deliberately bypasses Authentik's own enrollment-flow stages (email
   * verification, captcha). Two calls: the user itself, then its initial password (set_password
   * is a separate endpoint in Authentik's Admin API, not a create-time field). `groupNames`/
   * `attributes` are optional additions for callers that need the created account to land in a
   * specific group (e.g. employee/supervisor) or carry a custom flag (e.g. mustChangePassword) —
   * `enroll()` below still calls this with neither set, unaffected.
   */
  async createUser(input: {
    username: string;
    email: string;
    name?: string;
    password: string;
    groupNames?: string[];
    attributes?: Record<string, unknown>;
  }): Promise<AuthentikCreatedUser> {
    const groupPks = input.groupNames?.length
      ? await this.resolveGroupPks(input.groupNames)
      : undefined;
    const createResponse = await fetch(`${this.baseUrl}/api/v3/core/users/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiToken}`,
      },
      body: JSON.stringify({
        username: input.username,
        email: input.email,
        name: input.name ?? input.username,
        is_active: true,
        ...(groupPks ? { groups: groupPks } : {}),
        ...(input.attributes ? { attributes: input.attributes } : {}),
      }),
    });
    if (!createResponse.ok) {
      throw new AuthentikApiError(
        createResponse.status,
        await parseBody(createResponse),
      );
    }
    const user = (await createResponse.json()) as AuthentikCreatedUser;

    const setPasswordResponse = await fetch(
      `${this.baseUrl}/api/v3/core/users/${user.pk}/set_password/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({ password: input.password }),
      },
    );
    if (!setPasswordResponse.ok) {
      // The user now exists but has no usable password — no compensating rollback (DELETE
      // /api/v3/core/users/{pk}/) in v1, see servers/auth/CLAUDE.md's known-limitations section.
      // Logged loudly here since a silent partial failure would be far worse than a noisy one.
      console.error(
        `AuthentikClient.createUser: user ${user.pk} (${user.username}) was created but set_password failed with ${setPasswordResponse.status} — the account exists with no usable password`,
      );
      throw new AuthentikApiError(
        setPasswordResponse.status,
        await parseBody(setPasswordResponse),
      );
    }

    return user;
  }

  /** Looks up a user by exact username, throwing AuthentikApiError(404) if none exists. */
  private async findUserByUsername(username: string): Promise<AuthentikUser> {
    const userResponse = await fetch(
      `${this.baseUrl}/api/v3/core/users/?username=${encodeURIComponent(username)}`,
      { headers: { Authorization: `Bearer ${this.apiToken}` } },
    );
    if (!userResponse.ok) {
      throw new AuthentikApiError(
        userResponse.status,
        await parseBody(userResponse),
      );
    }
    const { results } = (await userResponse.json()) as {
      results: AuthentikUser[];
    };
    if (results.length === 0) {
      throw new AuthentikApiError(404, {
        error: `Authentik user not found: ${username}`,
      });
    }
    return results[0];
  }

  /**
   * Replaces a user's group memberships wholesale (e.g. FEAT-3's "promote to supervisor" —
   * moving the target out of "employee" and into "supervisor") — Authentik's Admin API takes
   * `groups` as a full replacement list on PATCH, not an add/remove delta.
   */
  async updateUserGroups(
    username: string,
    groupNames: string[],
  ): Promise<void> {
    const user = await this.findUserByUsername(username);
    const groupPks = await this.resolveGroupPks(groupNames);

    const patchResponse = await fetch(
      `${this.baseUrl}/api/v3/core/users/${user.pk}/`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({ groups: groupPks }),
      },
    );
    if (!patchResponse.ok) {
      throw new AuthentikApiError(
        patchResponse.status,
        await parseBody(patchResponse),
      );
    }
  }

  /**
   * Looks up a user's record (including custom `attributes`, e.g. `mustChangePassword` — see
   * FEAT-1's `createUser({ attributes: { mustChangePassword: true } })`) by username. Used by
   * SignInUseCase to read that flag after a successful sign-in.
   */
  async getUser(username: string): Promise<AuthentikUser> {
    return this.findUserByUsername(username);
  }
}

export class AuthentikPlugin extends BasePlugin {
  private client?: AuthentikClient;

  /** factory param allows injection in tests without touching the real client, same pattern as RedisPlugin/MeilisearchPlugin */
  constructor(
    private readonly container: AwilixContainer,
    private readonly createClient: () => AuthentikClient = () =>
      new AuthentikClient(),
  ) {
    super();
  }

  /**
   * Eager reachability check — throws on a bad AUTHENTIK_URL, failing server startup instead of
   * surfacing later on first sign-in/sign-up request — then registers `authentik` into the container.
   */
  async onStart(): Promise<void> {
    this.client = this.createClient();
    await this.client.healthCheck();
    this.container.register({ authentik: asValue(this.client) });
  }

  /** No-op — stateless HTTP client, nothing to close, same as MeilisearchPlugin. */
  async onStop(): Promise<void> {}
}
