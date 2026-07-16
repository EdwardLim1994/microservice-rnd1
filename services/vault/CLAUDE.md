# services/vault

Docker Compose stack: a single HashiCorp Vault container running `vault server -dev` — in-memory
storage, auto-unseal, root token fixed via `VAULT_DEV_ROOT_TOKEN_ID` (see `.env.sample`). Mirrors
`services/redis`/`services/meilisearch`'s "single container, one static default secret" shape.

## Every restart wipes all provisioning — this is normal, not an edge case

Dev mode never persists anything to disk. Any time the container restarts — `docker compose
restart vault`, a pod reschedule, `helm upgrade` triggering a rollout — Vault comes back up
completely empty: no secrets engine mounts, no database roles, no AppRole roles/policies. All of
that configuration (see `services/vault/ansible/`) has to be re-applied. The Ansible role that
provisions it is idempotent specifically so this re-run is safe and cheap — treat "did Vault just
restart?" as a routine question to ask, not a rare failure mode, and re-run
`bun run --filter <server> vault:provision` (see each server's own `CLAUDE.md`) whenever a
server's `VaultPgAdapter.fromEnv()` starts failing to authenticate or fetch creds.

- `VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200` is required — dev mode defaults to binding loopback-only,
  which nothing outside the container (Ansible provisioning, a server's `VaultPgAdapter`) could
  reach otherwise. Same class of gotcha as Redis's `--requirepass` needing to be passed explicitly.
- Root docker-compose.yml's `include:` brings this stack up as part of the same Compose project as
  every server — always start it that way (not standalone from this directory) if a server needs
  to reach it, same reasoning as `services/redis/CLAUDE.md`'s network/volume project-scoping note.
- No database secrets engine, AppRole auth, roles, or policies exist until a server's
  `services/vault/ansible/provision.yml` playbook has been run against this container at least
  once — see `services/vault/ansible/` for the provisioning role, and `packages/server/CLAUDE.md`'s
  Database section for how a server actually consumes the resulting dynamic credential.
- **Provisioning runs in a container, not on the host.** `services/vault/docker-compose.yml`'s
  `ansible` service (built from `services/vault/ansible/Dockerfile` — `ansible-core`, `hvac`, and
  the `community.hashi_vault` collection baked in) is a one-off tool container, not a long-running
  service — it's gated behind the `tools` Compose profile so a plain `docker compose up` never
  starts it, and is only invoked via `docker compose run --rm ansible ansible-playbook ...` (see
  each server's own `vault:provision` package.json script). This means **no local Python/
  ansible-core/hvac install is needed on the host** at all — only rebuild the image
  (`docker compose build ansible`) if `services/vault/ansible/requirements.yml` or its `Dockerfile`
  changes. The `ansible` service only joins the `vault` network (it only ever talks to Vault's own
  HTTP API, never directly to a server's Postgres), and mounts the whole repo at `/workspace` so it
  can read/write any server's `ansible/vars.yml`/`.env`.
- No lease renewal exists anywhere in this integration — a server's dynamic Postgres credential
  expires at its lease TTL (`default_ttl: 1h`, configured in the Ansible role's
  `database/roles/<name>-role`) and the server must restart to get a fresh one via
  `VaultPgAdapter.fromEnv()`. Accepted as a known gap for this prototype, not engineered around.
- The Postgres admin credential Vault uses to configure `database/config/<name>-db` is the same
  static superuser (`myuser`/`mypassword`) already scaffolded for that server's own Postgres
  container — not a separate Vault-only admin identity. See each server's `CLAUDE.md`/`.env.sample`
  (`DATABASE_URL`, also required by `prisma.config.ts` for Prisma CLI operations) for the
  human-facing side of this same credential.

There is no application code in this folder — just the Docker Compose stack, Helm chart,
Terraform module, and the `ansible/` provisioning role, same as `services/redis`/
`services/meilisearch`.

## PKI secrets engine — TLS leaf certs for internal mTLS

`services/vault/ansible/roles/provision-server-vault` provisions two independent things per
server, both idempotent and both wiped on every dev-mode restart same as the database engine
above: `database/*` (only when the server's `ansible/vars.yml` defines `db_name`) and `pki_int/*`
(controlled by `provision_tls`, defaulting to `true` — see `roles/provision-server-vault/defaults/
main.yml`), a single self-signed-root PKI mount issuing short-lived leaf certs
(`pki_int/roles/<server>-tls-role`). Both land on the **same** AppRole/policy as the server's
existing database role — one credential pair, however many secrets engines it's allowed to touch.
See `packages/server/CLAUDE.md`'s TLS section for how a server consumes the resulting cert
(`VaultTlsAdapter.fromEnv()`).

- A TLS-only server (no DB — e.g. `servers/auth`) still gets provisioned via this same role;
  `db_name` is simply left undefined in its `ansible/vars.yml`, which skips every `database/*` task
  and only runs the `pki_int/*` ones.
- Non-`servers/*` peers (e.g. Apollo Router, a pure mTLS *client* rather than a "server" in this
  repo's per-server convention) get their own `ansible/vars.yml` + `vault:provision` script too —
  see `services/apollo/ansible/vars.yml` and its `server_env_dir: services/apollo` override (the
  role's default `.env` write path assumes `servers/<name>`, so anything outside that directory
  needs to say where its own `.env` actually lives).
- Same lease-TTL gap as the database credential: nothing renews a leaf cert (`pki_int/roles/
  <name>-tls-role`'s `default_ttl`/`max_ttl`, `services/vault/ansible/roles/provision-server-vault/
  defaults/main.yml`) — a restart re-fetches via `VaultTlsAdapter.fromEnv()`, same accepted gap as
  `VaultPgAdapter`.
- The mount's own root CA (`pki_int/root/generate/internal`) is regenerated every time the mount
  itself is (re-)created — i.e. every dev-mode Vault restart, same as everything else here. Every
  peer's leaf cert trusts whatever CA is currently live, so a stale CA left over from before a
  restart is never a concern — there's nothing left over, dev mode wipes it all.
