# services/debezium

Docker Compose stack: `kafka-connect` (Kafka Connect worker, image built from `kafka-connect/
Dockerfile` — `confluentinc/cp-kafka-connect` plus the Debezium Postgres connector plugin
installed via `confluent-hub`), running Change Data Capture for servers with their own Postgres
(currently just `test1`). No application code here — just the Compose stack and the `ansible/`
provisioning role, same shape as `services/vault`/`services/kafka`.

## How it fits together

CDC here means: Debezium's Postgres connector, running inside `kafka-connect`, reads a server's
Postgres write-ahead log via logical replication and emits one Kafka topic per table
(`<server_name>.<schema>.<table>`, e.g. `test1.public.<table>`) — Avro-encoded through the same
`schema-registry` (`services/kafka`) every other topic in this repo uses (see
`packages/server/CLAUDE.md`'s `SchemaRegistryKafkaSerializer`). It's a separate write path from a
server's own `KafkaDriver` producer calls — CDC topics are named with a dot-separated
`<server_name>.<schema>.<table>` prefix specifically so they never collide with a topic name an
app produces to directly.

- **A server's Postgres must run with `wal_level=logical`** — the `postgres:15.3-alpine` image
  (used by `test1-db` etc.) defaults to `replica`, enough for physical replication/backups but not
  logical decoding. Each server's own `docker-compose.yml` sets this via
  `command: ["postgres", "-c", "wal_level=logical"]` on its Postgres service — see
  `servers/test1/docker-compose.yml`. Only takes effect from container start; a running container
  with this unset needs a restart (a plain config reload isn't enough for `wal_level`).
- **The connector uses each server's existing static superuser** (`myuser`/`mypassword`, same
  credential already scaffolded for that server's own Postgres and reused by Vault's
  `database/config/<name>-db` admin connection — see `services/vault/CLAUDE.md`) — not a
  Vault-issued dynamic credential. This is a deliberate prototype simplification: Debezium expects
  one stable, long-lived replication-privileged role, which sits awkwardly against
  `VaultPgAdapter`'s rotating leases (`default_ttl: 1h`). A real deployment would want a dedicated
  static replication role provisioned outside Vault's rotation, or Vault's static-role feature —
  not attempted here.
- **No plugin install needed on the Postgres side** — the connector uses `plugin.name: pgoutput`,
  which ships built into Postgres 10+ (unlike `wal2json`, which needs a separate extension). The
  replication slot (`<server_name>_slot`) and publication (`<server_name>_publication`) are both
  created automatically by the connector on first registration — no manual `CREATE PUBLICATION`/
  `SELECT pg_create_logical_replication_slot` step for the *initial* set of tables (see the
  reconciliation note below for what happens after that).
- **Debezium creates the publication once and never re-syncs it on its own.** If `cdc_tables`
  changes on a later `cdc:provision` run, updating the connector's `table.include.list` alone only
  changes what gets *forwarded to Kafka* — the publication (and therefore what the replication slot
  decodes from the WAL in the first place) stays exactly as it was the first time the connector
  started, even across a full config `PUT`. `services/debezium/ansible/roles/provision-server-cdc/
  tasks/main.yml` reconciles this explicitly every run: it reads the publication's actual current
  membership (`community.postgresql.postgresql_query` against `pg_publication_tables`), diffs it
  against `cdc_tables`, and issues `ALTER PUBLICATION ... ADD TABLE`/`... DROP TABLE` for whatever's
  missing/extra *before* touching the connector config — so removing a table from `cdc_tables`
  actually stops it (no more WAL decoding for that table at all), not just stops it from reaching
  Kafka. This reconciliation only runs when the publication already exists and `cdc_tables` is
  non-empty — skipped on a server's very first provisioning run (nothing to reconcile against yet;
  Debezium creates the publication itself, already scoped to `cdc_tables`, when the connector
  starts) and skipped for a publication still in `all_tables` mode (Postgres rejects
  `ALTER PUBLICATION ... ADD/DROP TABLE` outright against a `FOR ALL TABLES` publication).
- `kafka-connect` joins both the `kafka` network (its own Kafka traffic, and REST API access from
  the `debezium-ansible` tool container) and the `adminer` network (to reach a server's Postgres
  container directly by hostname, e.g. `test1-db` — same reason `services/vault`'s container joins
  `adminer` for its own DB connection). `debezium-ansible` joins both networks too, for the same
  reason — the publication reconciliation above talks to Postgres directly, not just to
  `kafka-connect`'s REST API.
- `kafka-connect` has a Docker healthcheck (`curl .../connectors`) — same "container up isn't the
  same as ready" reasoning as `services/kafka/CLAUDE.md`'s own healthcheck note. Nothing in this
  repo currently `depends_on` it, since connector registration goes through Ansible, not another
  service's startup.

## Setting up a new server's connector: `turbo gen cdc`

Wiring a new Prisma-backed server up for CDC is a `turbo gen cdc` away (see
`turbo/generators/serverExtension/CdcGenerator.ts`) — run it *after* `turbo gen database` (CDC
needs a server that already has Postgres/Prisma; the generator's own target-server prompt only
lists servers `findPrismaServerWorkspaces` finds). It:

- Adds `kafka_connect_addr`/`schema_registry_addr`/`cdc_tables` to that server's `ansible/vars.yml`
  (created earlier by `turbo gen database`'s own Vault-provisioning action) the first time it's
  run. `kafka_connect_addr`/`schema_registry_addr` are then left alone on later runs (they never
  change), but **`cdc_tables` is kept in sync in place on every run** — re-run `turbo gen cdc`
  whenever the set of tables to capture changes, and it'll update just that value, not skip the
  whole thing the way a first-glance idempotent-append might.
- Sets `wal_level=logical` on that server's `<name>-db` Postgres service in its own
  `docker-compose.yml`, same as `servers/test1/docker-compose.yml`'s hand-added line — skipped if
  already present.
- Adds a `cdc:provision` script to that server's `package.json` — skipped if already present.
- Prompts for which tables to capture: a checkbox of that server's own `schema.prisma` models
  (respecting `@@map`, since that's the real Postgres table name) if any exist yet, or a free-text
  fallback (comma-separated `schema.table`) for a freshly-scaffolded server whose schema is still
  empty. Selecting nothing captures every table (`publication.autocreate.mode: all_tables`);
  selecting specific tables scopes both the connector and its publication to just those
  (`publication.autocreate.mode: filtered`, `table.include.list`) — see
  `ansible/roles/provision-server-cdc/defaults/main.yml` and `tasks/main.yml` for how `cdc_tables`
  drives that switch, and the reconciliation note above for what re-running with a changed
  `cdc_tables` actually does to an already-existing publication.

The generator only scaffolds config — it doesn't call Kafka Connect's REST API itself (the
containers may not even be running at `turbo gen` time). That's still a separate step below.

## Provisioning a server's connector

**Registering the connector is not automatic** — no server currently registers a Debezium
connector on its own startup, so `kafka-connect` coming up healthy doesn't mean CDC is flowing yet.
Run `bun run cdc:provision` inside a server's own directory (after `docker compose up` brings up
`kafka`, `schema-registry`, `kafka-connect`, and that server's own Postgres) — see
`servers/test1/package.json`'s `cdc:provision` script and `ansible/provision.yml`.

- **Provisioning runs in a container, not on the host** — same pattern as
  `services/vault/ansible/`. The `debezium-ansible` service (`services/debezium/docker-compose.yml`,
  built from `ansible/Dockerfile`) is a one-off tool container gated behind the `tools` Compose
  profile, invoked via `docker compose run --rm debezium-ansible ansible-playbook ...`. No local
  Python/ansible install needed on the host.
  - Named `debezium-ansible` rather than `ansible` specifically to avoid colliding with
    `services/vault/docker-compose.yml`'s own same-named service once the root
    `docker-compose.yml`'s `include:` pulls both into one Compose project.
  - Needs `ansible-core` plus the `community.postgresql` collection (`psycopg2-binary` installed
    alongside it) — registering the connector is still a plain HTTP `PUT` to Kafka Connect's REST
    API via the built-in `ansible.builtin.uri` module, but reconciling the publication's table
    membership (see above) talks to Postgres directly.
- **Unlike Vault provisioning, this isn't something you need to routinely re-run just because a
  container restarted.** Kafka Connect persists connector configs to a Kafka topic
  (`CONNECT_CONFIG_STORAGE_TOPIC`), so they survive a `kafka-connect` container restart. Re-run
  `cdc:provision` when `cdc_tables` changes (a table was added or removed) — the playbook is
  designed to be safely re-run any time that happens, not just once.
- The connector `PUT` itself (`ansible/roles/provision-server-cdc/tasks/main.yml`'s last task) is
  idempotent on its own — Kafka Connect's REST API no-ops the restart if the submitted config
  matches what's already stored. The publication reconciliation tasks that run before it are
  idempotent too: `ALTER PUBLICATION ... ADD/DROP TABLE` only runs for tables that are actually
  missing/extra (computed via a `difference()` diff against the publication's real membership),
  not unconditionally, so a re-run with an unchanged `cdc_tables` does nothing.
- **`cdc:provision` also self-heals a stuck connector.** The playbook's first two tasks check
  `GET .../status` and, if the connector or any of its tasks report `FAILED` (e.g. Postgres
  restarted and invalidated the replication slot, or a transient error during startup), issue
  `POST .../restart?includeTasks=true&onlyFailed=true` before doing anything else — so re-running
  `cdc:provision` also doubles as "is CDC actually still flowing for this server?", not just a
  config push. A fresh, not-yet-registered connector (`404` from `/status`) is handled the same as
  a healthy one — the restart check is skipped, not treated as an error.
- **Noisy internal tables are excluded by default when capturing every table.** `cdc_tables: []`
  (capture everything) sets `table.exclude.list: public._prisma_migrations` on the connector — so
  Prisma's own migrations-tracking table never gets a CDC topic of its own, without anyone having
  to explicitly scope `cdc_tables` just to avoid it. Only applies in `all_tables` mode; when
  `cdc_tables` is non-empty, `table.include.list` is already an allow-list and has nothing extra to
  exclude. Override `cdc_default_exclude_list` per-server if a different default makes sense.
- **`snapshot.mode` and dead-letter-queue handling are configurable, not hardcoded.** `cdc_snapshot_mode`
  (default `initial` — Debezium's own default: snapshot every existing row once, then stream
  changes) can be overridden per-server, e.g. to `no_data` to skip an expensive initial snapshot on
  a table with a lot of pre-existing rows nobody needs the history of. Every connector also gets
  `errors.tolerance: all` plus a per-server dead-letter topic (`<server_name>-cdc-dlq`) — Kafka
  Connect's own framework default (`errors.tolerance: none`) fails the *entire* connector task on
  the first message it can't handle (e.g. an Avro encoding mismatch); routing that one message to
  the DLQ instead keeps the rest of that table's events flowing.

## Deploying to Kubernetes

`services/debezium/helm` + `services/debezium/terraform` deploy `kafka-connect` the same way
`services/kafka`/`services/redis`/`services/vault`/`services/apollo`/`services/meilisearch` do —
registered as its own `module "debezium"` in `services/terraform/main.tf` (the always-on shared
infra root), sharing the `infra` namespace. Not yet actually deployed/verified in a live cluster
(see the root `CLAUDE.md`'s Kubernetes end-to-end testing section for what *has* been verified so
far) — this is the Helm chart + Terraform module existing and validating cleanly
(`terraform validate`, `helm template`), following the exact same shape as its siblings, not a
confirmed working in-cluster deployment yet.

- **The image is custom-built, unlike every other chart in `services/terraform`.** `kafka`/
  `schema-registry`/`redis`/`vault`/`apollo-router`/`meilisearch` all deploy off-the-shelf images —
  `kafka-connect` is the first `services/*` chart whose image is built locally
  (`services/debezium/kafka-connect/Dockerfile`, same one `docker-compose.yml`'s own `kafka-connect`
  service builds). `services/debezium/package.json`'s `k8s:build` script
  (`docker build -f services/debezium/kafka-connect/Dockerfile -t debezium-kafka-connect:local
  services/debezium/kafka-connect`) plugs into the root `bun run k8s:build` the same way
  `servers/test1/package.json`'s own `k8s:build` does — run it (against minikube's own Docker
  daemon, via the root script's `eval "$(minikube docker-env)"`) before `terraform apply`, same as
  any server's own image. Unlike a server's Dockerfile, this one's build context is
  `services/debezium/kafka-connect` itself, not the repo root — it copies nothing from the
  monorepo, so there's nothing to gain from the wider context.
- **Provisioning against an in-cluster `kafka-connect` isn't solved yet.** `debezium-ansible`
  (the provisioning tool container) is a Docker Compose-only concept — there's no in-cluster
  equivalent (a Job, a port-forwarded host run, etc.) yet. This is the same acknowledged gap as
  Vault's own k8s story (`servers/demo1`'s Helm values still point at docker-compose-based
  addresses per `services/terraform/CLAUDE.md`) — a deliberate, separate follow-up, not attempted
  here.
