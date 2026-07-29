# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Bun + Turborepo monorepo. Run everything from repo root; Turbo fans out to workspaces.

- `bun install` — install deps (packageManager pinned: `bun@1.3.14`)
- `bun run dev` — run all workspaces' `dev` (persistent, no cache)
- `bun run build` — build all workspaces
- `bun run test` — run all workspaces' `test` (each package uses `rstest`, e.g. `packages/script`); to run a single package's tests, `cd` into it and run `bun run test`, or `turbo run test --filter=<package-name>`
- `bun run lint` / `bun run format` / `bun run check` — Biome-based lint/format/check per workspace
- `bun run gen` — `turbo run gen` (codegen, e.g. GraphQL codegen) then rebuilds `api` specifically
- `bun run generate` — `turbo gen`, runs the Plop generators under `turbo/generators/` (see below)
- `bun run supergraph` — builds/composes the Apollo Federation supergraph
- `bun run k8s:build` — builds workspace Docker images against the minikube docker daemon (`eval "$(minikube docker-env)"` first)
- `bun run release:cut` / `release:bump-rc` / `release:promote` / `release:hotfix` / `release:touched-apps` — release flows, all implemented in `packages/script/src/bin/release-manager.ts`
- `tilt up` from repo root — the primary way to run this repo locally. Root `Tiltfile` `include()`s `services/`, `apps/servers/`, `apps/web/`, `apps/mfe/` own `Tiltfile`s, each of which renders its own `helm/` chart via Tilt's `helm()` and `docker_build()`s any locally-built images (see each workspace's own `helm/` + `Dockerfile`). Chart dependencies (e.g. `services/traefik/helm`, `services/authentik/helm`) aren't fetched by Tilt itself — run `helm dependency update <chart-dir>` manually after editing a `Chart.yaml`'s `dependencies:`.
- `docker compose up` from repo root — kept as a working backup, not the primary path anymore. Root `docker-compose.yml` `include:`s `services/`, `servers/`, `frontends/`, `apps/` own compose files. Some compose-only pieces have no Tilt/helm equivalent yet (e.g. `services/adminer` was retired outright in favor of Grafana, not migrated).

## Architecture

### Workspace layout

- `services/*` — third-party infra run in-repo (Apollo router/gateway, Authentik, Kafka, Redis, Meilisearch, MinIO, Vault, Traefik, monitoring, Apicurio Registry, ClickHouse). `adminer` was retired outright (replaced by Grafana, see `services/monitoring`), not migrated to helm. Debezium was removed from here — CDC is moving to a per-server Debezium Server instance (one process per Postgres database being captured, not a shared Kafka Connect cluster), not yet scaffolded.
- `servers/*` — backend microservices (e.g. `servers/auth`), each a thin composition root over the shared `packages/server` framework
- `frontends/*` — React Module Federation microfrontends, generated via `turbo gen web` (remote role)
- `apps/*` — user-facing apps: the microfrontend host, mobile app, plain (non-MF) web apps, and the docs site
- `packages/*` — shared libraries: `server` (backend framework), `api` (shared GraphQL/API types, built with rslib), `config` (shared config), `script` (release tooling, CLI in `src/bin/`)
- `e2e/` — end-to-end tests (Cypress + Vitest/API tests)
- `turbo/generators/` — Plop code generators, invoked via `bun run generate`

### Tilt + Helm (primary local-dev runtime)

Every `services/*`, `apps/servers/*`, `apps/web/*`, `apps/mfe/*` workspace owns a `helm/` chart (`Chart.yaml` + `values.yaml` + `templates/`) and a `Tiltfile`, included transitively from the root `Tiltfile` via each directory's own `Tiltfile` (`services/Tiltfile`, `apps/servers/Tiltfile`, etc — mirrors the old docker-compose `include:` chain). `turbo gen server` / `turbo gen web` scaffold both automatically for new workspaces (`turbo/generators/templates/*/helm/` + `Tiltfile`), registering the new `Tiltfile` into its parent's include list the same way they used to register a `docker-compose.yml`.

Patterns established during the docker-compose → Tilt/helm migration:
- Simple single/multi-container infra (Redis, Meilisearch, MinIO, ClickHouse, Apicurio Registry, Vault, Kafka) — hand-rolled charts, no upstream chart dependency; matches what the old compose file actually ran, nothing more.
- Infra with a real, trustworthy upstream chart (Traefik, Authentik, Apollo Router) — that chart as a `dependencies:` entry in `Chart.yaml` instead of reinventing its RBAC/CRDs/subcharts. `charts/` (the fetched dependency `.tgz`s) is gitignored; `Chart.lock` is committed. Apollo Router's `router.yaml`/`supergraph.graphql` config lives inline in `values.yaml` under the dependency's own schema, not `.Files.Get` — that chart takes config as values, not mounted files.
- A locally-built image (any generated server/frontend) — a `Dockerfile` + the workspace's `Tiltfile` calls `docker_build()`, referenced by tag from `helm/templates/*.yaml`.
- One-off provisioning tools (`*-ansible` containers, `rover`) — not migrated; they're not long-running workloads, still invoked via `docker compose run --rm <service> ...` against the kept-as-backup compose files.
- `turbo/generators`' `database` server extension scaffolds a `<name>-db` chart (Postgres + a `<name>-migrate` k8s `Job`, the Job built from the same `Dockerfile`'s `migrate` stage via a second `docker_build()`) and wires `DB_HOST`/`DB_PORT`/etc into the server's own `Deployment` via a `ConfigMap` + `envFrom` (see `wireHelmDeploymentConfigMap` in `turbo/generators/helpers.ts`); the `kafka` server driver extension does the same for `KAFKA_BROKERS`/`SCHEMA_REGISTRY_URL`. Both append their own `configMapRef` to the same `envFrom:` list rather than clobbering each other.
- Known gap: Vault's ansible-based provisioning (`vault:provision` script) still runs via `docker compose run` and only resolves `vault`/`<name>-db` hostnames while those compose backups are actually running alongside their k8s equivalents — not yet ported to an in-cluster k8s `Job`.

### Backend server framework (`packages/server`)

Every microservice under `servers/*` is a small `index.ts` calling into `src/app.ts`, which composes a `ServerApp` (`packages/server/src/ServerApp.ts`) via a fluent builder:

```ts
await ServerApp.init([{ driver: ApolloDriver, port, config: { tls }, onReady }])
  .plugins([AuthentikPlugin])
  .routers([AuthGraphqlRouter])
  .database(PrismaClient, dbAdapter)   // optional
  .run(() => "Server is running");
```

Key pieces (all under `packages/server/src/`):
- **Drivers** (`driver/`) — protocol adapters that actually listen: `ApolloDriver` (GraphQL), `GrpcDriver`, `CronDriver`, `KafkaDriver`. A `ServerApp` can run multiple drivers in parallel (e.g. GraphQL + gRPC on different ports), each started concurrently in `run()`.
- **Routers** (`router/`) — one `BaseRouter` subclass per driver type (`GraphqlRouter`, `GrpcRouter`, `CronRouter`, `KafkaRouter`); shared across all drivers in a given `ServerApp`.
- **Interceptors** (`interceptor/`) — request-level middleware applied across drivers.
- **Plugins** (`plugin/`) — server-lifecycle hooks (`onStart`/`onStop`) for external integrations: `AuthentikPlugin`, `RedisPlugin`, `MeilisearchPlugin`, `MinioPlugin`, `OtelPlugin`.
- **DI container** — an `awilix` container (`InjectionMode.PROXY`) threaded through routers/interceptors/plugins; `.containers()` registers additional entries (e.g. repositories).
- **Database** (`database/DbAdapter.ts`) — Prisma client wiring; `dbAdapter` can be a value (e.g. `new PgAdapter(databaseUrl)`, the generated default — static superuser creds) or an async factory, resolved before drivers start for adapters that need an async round trip to obtain credentials. Vault-backed dynamic Postgres credentials (`VaultPgAdapter`) were removed pending a redesign; `VaultTlsAdapter` (mTLS leaf certs for `GrpcDriver`/`ApolloDriver`) was removed too, same reason — Vault security work now lives entirely in `services/vault`'s own chart, not in per-server app code. `TlsConfig` (the plain `{ca, cert, key}` shape `GrpcDriver`/`ApolloDriver`/`startStandaloneServerTls` take) stays in `database/TlsConfig.ts`, decoupled from however a cert gets obtained.

`stop()` reverses `run()`'s order: plugins stop, then drivers stop, then the DB disconnects.

### Code generators (`turbo/generators/`)

Plop-based scaffolding, registered in `turbo/generators/config.ts`:
- `ServerCodeGenerator` — `turbo gen server` scaffolds a new `apps/servers/<name>` from `templates/server` (including a `helm/` chart + `Tiltfile`), and registers its `Tiltfile` into `apps/servers/Tiltfile`'s include list.
- `FrontendCodeGenerator` — `turbo gen web` scaffolds `apps/<name>` or `frontends/<name>` (including a `helm/` chart + `Tiltfile`), inferring host vs. remote Module Federation role from location (`apps/` → host modeled on `portal`, `frontends/` → remote modeled on `frontend1`), or a plain non-MF app. Also assigns a free dev port and registers the `Tiltfile` include.
- `ServerDriverGenerator` / `ServerExtensionGenerator` — add drivers (Kafka, etc.) or extensions (database, etc.) to an existing server, wiring the generated `helm/templates/deployment.yaml` (via `envFrom`/`ConfigMap`) and `Tiltfile` rather than a `docker-compose.yml`.
- `helpers.ts` — shared generator utilities: `copyWithSubstitutions` (Handlebars-templated file copy), `appendRootTiltfileInclude`, `wireHelmDeploymentConfigMap`, `findAvailableFrontendPort`.

Generator actions register through `plop.setActionType`, which is a single global registry keyed by name (not scoped per generator) — never reuse an action name across generators, it will silently overwrite the earlier registration.

Note: newly-scaffolded servers/frontends get a `helm/` chart + `Tiltfile` generated automatically (see "Tilt + Helm" above), not a `docker-compose.yml` — Terraform module scaffolding was removed earlier and stays removed.
