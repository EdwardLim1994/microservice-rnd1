
# services/authentik

Docker Compose stack: `authentik-server` + `authentik-worker` (both the same
`ghcr.io/goauthentik/server` image, split by `command: server` / `command: worker` — this is
authentik's own required topology, not a pattern borrowed from elsewhere in this repo), backed by
a dedicated `authentik-postgresql` and `authentik-redis`. Reachable at `http://localhost:9000`
(`:9443` for HTTPS). `servers/auth` is the first integration — a GraphQL server exposing
`signIn`/`signUp`/`signOut`, see that server's own `CLAUDE.md` for the mutation-to-Authentik-API
mapping.

## Provisioning Authentik's own internal objects — `ansible/`

Authentik doesn't know about a consuming server until it has its own OAuth2 Provider, Application,
service-account user, and API token. `ansible/` provisions these idempotently, mirroring
`services/vault/ansible/`'s exact shape (an Ansible playbook run inside a one-off Compose
`tools`-profile container, `docker compose run --rm authentik-ansible ansible-playbook ...`,
invoked per-consumer via that server's own package.json script — see `servers/auth/CLAUDE.md`'s
`auth:provision` section). Two differences from Vault's version:
- **`ansible.builtin.uri`** (ships in `ansible-core` itself) instead of a dedicated
  `community.hashi_vault`-style collection — no `requirements.yml`/extra `ansible-galaxy` install
  needed, since every task here is a plain REST call against Authentik's own API.
- Authenticated via **`AUTHENTIK_BOOTSTRAP_TOKEN`** (a real Authentik env var — set on
  `authentik-server`/`authentik-worker` at boot, mints a ready `akadmin` API token immediately, no
  password-login round-trip needed) rather than a fixed dev-mode root token like Vault's `root` —
  generate a real one via `openssl rand -hex 32`, same "local-dev placeholder, generate a real one
  beyond a throwaway stack" convention as `AUTHENTIK_SECRET_KEY` above. Passed through to the
  `authentik-ansible` tool container's own `environment:` block so
  `servers/auth/ansible/vars.yml`'s `lookup('env', ...)` can read it — **never** hardcoded into a
  committed `vars.yml` the way Vault's fixed `root` token is, since this one is a real
  per-deployment secret.

### Self-service enrollment flow (`register`)

The same role also provisions a real enrollment flow — slug `{{ server_name }}-enrollment-flow`
(`auth-enrollment-flow` for `servers/auth`) — backing `register`'s signup path, replacing the
Admin-API-bypass `createUser()` this repo started with. A single `ak-stage-prompt` stage collects
two fields (`username` — labeled "Email" in the UI, `type: email` for real format validation, but
written as Authentik's actual `username` field, not a separate `email` attribute — and
`password`), bound to Authentik's own built-in `default-password-change-password-policy` (min
length 8 + zxcvbn strength check) for validation, followed by a `UserWriteStage`
(`user_creation_mode: always_create`). Reusing `username` for the submitted email means
identification-by-email in the authentication flow (`AuthentikClient.signIn()`) needs no extra
plumbing, and a duplicate-email registration surfaces for free as a `username` uniqueness
`IntegrityError`.

Confirmed empirically against a running 2026.5.4 instance (`GET`/`POST` against
`/api/v3/flows/executor/{{ enrollment_flow_slug }}/`) — three outcomes, all consumed by
`AuthentikClient.enroll()` (`packages/server/src/plugin/AuthentikPlugin.ts`):
- **Success**: eventually resolves to `{"component": "xak-flow-redirect", "to": "/"}`. The
  prompt-stage `POST` itself is unreliable about returning this directly — it sometimes comes back
  as a bare 3xx redirect with no JSON body even though the write already committed server-side —
  so `enroll()` always confirms via a follow-up `GET` on the same session rather than trusting the
  `POST` response alone.
- **Duplicate email**: `{"component": "ak-stage-access-denied", "error_message": "Failed to
  update user. Please try again later.", "pending_user": "<email>"}` — generic wording, but this
  flow's only realistic write failure (the prompt stage's own `type: email` validation already
  rejects a malformed address before the write stage even runs).
- **Password policy failure**: a re-rendered `ak-stage-prompt` challenge with
  `response_errors.non_field_errors[0].string` set to the bound policy's own `error_message`
  (e.g. "Password needs to be 8 characters or longer.").

Idempotency is achieved by looking up every object before creating it (by name/slug/username), and
by managing the API token as an ordinary `Token` resource with a fixed `identifier` rather than
via Authentik's `/api/v3/core/users/service_account/` convenience endpoint (which mints a new
token as a side effect on every call, with no "already exists" check) — Authentik's `POST
/api/v3/core/tokens/{identifier}/view_key/` lets the role re-read a token's plaintext value on
every run, freshly created or not, which is what makes the whole thing safely re-runnable without
caching the token anywhere itself.

**Not required on every restart**, unlike Vault dev mode — see `servers/auth/CLAUDE.md` for why
(Authentik's Postgres is persistent, Vault dev mode's isn't). Only the tool container's own
`authentik-ansible` service name matters for the root `docker-compose.yml`'s merged project (not
`ansible`, which `services/vault/docker-compose.yml` already claims) — see that file's own comment
for the collision this avoids.

**No in-cluster (Helm) equivalent yet** — this provisioning story is `docker compose run`-only
today; `helm/values.yaml`'s `bootstrap.token` exists so a future Helm Job/hook has the plumbing
available, but nothing runs it in-cluster yet.

- Unlike `services/vault`'s `VaultPgAdapter` (which provisions short-lived credentials into an
  *app's own* Postgres) or `services/redis`/`services/meilisearch` (shared general-purpose
  cache/search consumed via `server`'s plugins), authentik's Postgres and Redis are **private to
  this stack** — its own schema/session store, not something any `servers/*` app should connect to
  directly. Don't reuse `services/redis`'s `redis` container for authentik's cache; it's a
  separate `authentik-redis` container on its own `authentik` bridge network for the same
  network-isolation reason `services/meilisearch/CLAUDE.md` gives for its own dedicated network.
- `AUTHENTIK_SECRET_KEY` signs cookies/tokens — the `.env.sample` default
  (`changeme-generate-a-real-secret-key`) is a local-dev placeholder only, same convention as
  `services/vault`'s dev root token; generate a real one (e.g. `openssl rand -base64 60`) for
  anything beyond a throwaway local stack.
- `AUTHENTIK_BOOTSTRAP_EMAIL` / `AUTHENTIK_BOOTSTRAP_PASSWORD` create the initial `akadmin`
  superuser on first boot (authentik-native bootstrap env vars — no separate `docker compose run`
  provisioning step needed, unlike `services/vault`'s Ansible-driven AppRole setup).
  `AUTHENTIK_BOOTSTRAP_PASSWORD` only takes effect if no admin user already exists, so changing it
  after first boot has no effect until the stack is torn down with its volumes.
- `authentik-server`'s healthcheck hits authentik's own `/-/health/ready/` endpoint — a `30s
  start_period` because authentik's first boot runs its Django migrations before the server is
  actually ready, same reasoning as `services/debezium`'s Kafka Connect healthcheck
  `start_period`. `authentik-worker` has no healthcheck of its own (no HTTP port to probe); its
  readiness is implied by `authentik-postgresql`/`authentik-redis` both being
  `service_healthy` via `depends_on`.
- The `authentik-postgresql-data`/`authentik-redis-data`/`authentik-media`/`authentik-certs`
  named volumes are scoped by Compose **project name**, same caveat as every other `services/*`
  stack's data volume (see `services/meilisearch/CLAUDE.md`) — always bring this stack up via the
  root `docker-compose.yml`, not standalone from inside `services/authentik/`.
- Image tag (`AUTHENTIK_TAG`, default `2026.5.4`) is pinned rather than `latest` — authentik ships
  breaking changes across releases (schema migrations aren't always backward-compatible); verify
  this is still current before bumping, and expect to re-check `docs.goauthentik.io`'s release
  notes when you do.
- The worker deliberately does **not** mount `/var/run/docker.sock` — upstream's reference compose
  does this to let authentik manage Docker-based outposts (e.g. auto-provisioned proxy
  containers), a feature this stack isn't using yet. Add it back only if/when that specific
  outpost mode is needed.

There is no application code in this folder — just the Docker Compose stack above, same as
`services/redis`, `services/meilisearch`, `services/kafka`, `services/adminer`, and
`services/apollo`.
