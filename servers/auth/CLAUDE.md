
# servers/auth

GraphQL-only server (no gRPC, no Kafka, no Postgres of its own) exposing `signIn`/`signUp`/
`signOut` mutations, backed entirely by `services/authentik/` — a standalone Authentik deployment
(see its own `CLAUDE.md`). This server holds no user data itself; it's a thin GraphQL façade over
Authentik's own APIs, registered as an Apollo Federation subgraph like every other server (one
Apollo Router endpoint for everything — see the root `CLAUDE.md`'s Layout section).

## The three mutations, and which Authentik API each one calls

- **`signIn(username, password): AuthTokens!`** — **not** the OAuth2 "password" grant (see below
  for why) — drives Authentik's Flow Executor API (`/api/v3/flows/executor/
  default-authentication-flow/`) through its identification → password stages (which *does* check
  the account's real password), then completes a standard Authorization Code exchange
  (`/application/o/authorize/` → `/application/o/token/`) once the resulting session is
  authenticated. On a failure anywhere in that sequence, returns a `GraphQLError` with
  `extensions.code: 'INVALID_CREDENTIALS'` — never Authentik's raw error body, to avoid leaking IdP
  internals to the client.
- **`signUp(input): SignUpResult!`** — direct Admin API user creation: `POST
  /api/v3/core/users/` then `POST /api/v3/core/users/{pk}/set_password/`, authenticated with a
  service-account API token (provisioned below). **Deliberately bypasses Authentik's own
  enrollment-flow stages** (email verification, captcha, password policy) — a known v1 limitation,
  not solved here. If `set_password` fails after the user was already created, that's logged loudly
  server-side (the account exists with no usable password) — there's no compensating rollback
  (`DELETE /api/v3/core/users/{pk}/`) in this version.
- **`signOut(refreshToken): Boolean!`** — OAuth2 token revocation, `POST
  /application/o/revoke/` (RFC 7009). No session/cookie concept here — the GraphQL client is
  expected to hold the token pair `signIn` returned and pass the refresh token back explicitly.
  Per RFC 7009, this always returns `true` on any 2xx, whether or not the token was already dead —
  only a genuine transport/5xx failure throws.

All three go through `AuthentikClient`/`AuthentikPlugin` (`packages/server/src/plugin/
AuthentikPlugin.ts`) — a plain-`fetch` thin client following the same convention as
`VaultPgAdapter`, registered into the container as `authentik` (awilix PROXY mode, like
`redis`/`meilisearch`). Requires `AUTHENTIK_URL`, `AUTHENTIK_OAUTH_CLIENT_ID`,
`AUTHENTIK_OAUTH_CLIENT_SECRET`, `AUTHENTIK_API_TOKEN` — all fail server startup eagerly if unset
(`AuthentikPlugin.onStart()`'s reachability check), same "fail fast" rationale as
`RedisPlugin`/`MeilisearchPlugin`.

## Why `signIn` isn't the OAuth2 "password" grant — a real discovery, not a design choice

The original plan was plain OAuth2 Resource Owner Password Credentials: `POST
/application/o/token/` with `grant_type=password`. Authentik's 2026.5 release does add a
per-provider "password" entry to its grant-types allow-list, which looks exactly like standard
ROPC support — **it isn't**. Reading `authentik/providers/oauth2/views/token.py` directly inside
the running container shows the "password" grant is implemented as a client-credentials-style
lookup against a separate **App Password** `Token` (`intent=app_password`), not a check of the
account's real password:

```python
user = User.objects.filter(username=username, is_active=True).first()
token = Token.objects.filter(key=password, intent=TokenIntents.INTENT_APP_PASSWORD, user=user).first()
```

Minting that App Password token for a user *other than the token-creating caller* turned out to be
hardcoded to require `is_superuser` (`authentik/core/api/tokens.py`'s `TokenViewSet.perform_create`
forces `user=self.request.user` for any non-superuser API caller — not something grantable via
ordinary RBAC permissions). Granting the service account `is_superuser` to work around this was
rejected — an unscoped escalation for what should be a least-privilege credential.

The actual fix: `signIn` drives the same path a browser would (Flow Executor + Authorization Code),
which validates the *real* `set_password`'d password and needs no superuser anywhere. Confirmed
empirically against a running 2026.5.4 instance — see `AuthentikClient.runAuthenticationFlow`'s and
`exchangeAuthorizationCode`'s own comments for the exact wire sequence, including two non-obvious
details found by testing, not docs:
- The default authentication flow's Authenticator Validation Stage (`not_configured_action: skip`)
  only re-evaluates its skip condition on a **fresh GET**, not on resubmitting the same challenge —
  matters because a user with no MFA device configured still has to pass through this stage.
- The OAuth2 Provider needs **explicit scope property mappings** (`openid`/`email`/`profile`/
  `offline_access`) bound via `property_mappings` — without them, Authentik silently grants zero
  scopes (logged as "Application requested scopes not configured, setting to overlap"), and
  critically **no `refresh_token` is issued** without `offline_access` specifically, which would
  silently break `signOut` (nothing to revoke).

## Provisioning — `bun run auth:provision`

Authentik doesn't know about this server until its own internal objects exist: an OAuth2 Provider
(confidential client, `authorization_code`+`refresh_token` grants, a registered `redirect_uri` —
see above for why not `password` — and the four scope property mappings), an Application, a
service-account user with a least-privilege RBAC role (`add_user`/`view_user`/
`reset_user_password` — exactly what `signUp` needs, nothing more), and that service account's API
token. `bun run auth:provision` runs `services/authentik/ansible/provision.yml` (Ansible, mirroring
`services/vault/ansible/`'s exact shape — a one-off `authentik-ansible` Compose `tools`-profile
container, `ansible.builtin.uri` calls against Authentik's REST API, authenticated with
`AUTHENTIK_BOOTSTRAP_TOKEN` — see `services/authentik/CLAUDE.md`) and writes the resulting
`AUTHENTIK_OAUTH_CLIENT_ID`/`AUTHENTIK_OAUTH_CLIENT_SECRET`/`AUTHENTIK_API_TOKEN` straight into this
server's own `.env` (never `.env.sample`).

**Unlike Vault dev mode's `vault:provision` (which must be re-run every time Vault restarts, since
dev mode forgets everything), this does NOT need to be re-run on every restart** — Authentik's own
Postgres is persistent (a named volume, not dev-mode in-memory storage), so the provisioned
Provider/Application/service-account/token all survive an `authentik-server`/`authentik-worker`
restart. Only re-run it if: this is a fresh Authentik deployment (new volume), or
`servers/auth/.env`'s Authentik credentials were lost/rotated by hand. The playbook is fully
idempotent either way — re-running it against an already-provisioned Authentik reconciles the
existing objects (and re-reads the existing API token's plaintext value via Authentik's
`view_key` endpoint) rather than creating duplicates. Verified end-to-end: signUp → signIn (real
JWT access/refresh/id tokens, correct claims) → signOut, plus the wrong-password and
duplicate-username error paths, all against a live local Authentik instance.

## Known v1 limitations

- Sign-up bypasses Authentik's enrollment-flow stages (email verification, captcha, password
  policy) entirely — a real self-service flow would drive Authentik's Flow Executor API's
  enrollment flow instead of the Admin API directly. Not built in this version.
- `signIn`'s Flow Executor driver only handles the exact default-authentication-flow stage shape
  confirmed empirically (identification → password → skippable MFA-validation → redirect). A
  flow customized to add a genuinely-required MFA stage, CAPTCHA, or consent prompt isn't
  supported — surfaces as a generic `INVALID_CREDENTIALS` error, not a distinct "MFA required" code.
- No lease/token renewal beyond what `signIn` itself returns — a client is expected to call
  `signIn` again (or implement its own refresh-token exchange against `/application/o/token/`,
  which this server doesn't expose a mutation for yet).
- `AuthentikAuthInterceptor` (`packages/server/src/interceptor/AuthentikAuthInterceptor.ts`) now
  exists for other servers to validate these tokens on incoming requests — see its own doc comment
  and `packages/server/CLAUDE.md`'s Interceptors section. Not yet wired into any server's
  `.interceptors([...])` by default; a server opts in explicitly, same as `AuthInterceptor` itself.
  Apollo Router's own `@authenticated`/`@requiresScopes` federation directives remain a separate,
  unbuilt alternative (gateway-level instead of per-server).
- No in-cluster (Helm/k8s) equivalent of `auth:provision` — `services/authentik/helm` has the
  `AUTHENTIK_BOOTSTRAP_TOKEN` plumbing in place, but nothing runs the provisioning Ansible role
  against an in-cluster Authentik yet. Local dev (`docker compose`) only, for now.
