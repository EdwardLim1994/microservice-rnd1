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
- `bun run k8s:build` — builds workspace Docker images for the local cluster (k3d: no separate docker-env step needed — Tilt's own `docker_build()` calls already `k3d image import` automatically; this script is for building outside Tilt)
- `bun run release:cut` / `release:bump-rc` / `release:promote` / `release:hotfix` / `release:touched-apps` — release flows, all implemented in `packages/script/src/bin/release-manager.ts`
- `tilt up` from repo root — the primary way to run `apps/servers/`, `apps/web/`, `apps/mfe/` locally. Root `Tiltfile` `include()`s only `apps/Tiltfile`, which in turn includes `apps/docs/Tiltfile`, `apps/servers/Tiltfile`, `apps/web/Tiltfile`, `apps/mfe/Tiltfile`; each workspace's own `Tiltfile` renders its `helm/` chart via Tilt's `helm()` and `docker_build()`s any locally-built images. No server/web/mfe workspace is currently scaffolded, so `apps/servers`, `apps/web`, `apps/mfe` only declare their shared Namespace object (`server-apps`/`apps`) right now — `bun run generate` scaffolds the first one. `services/*` is NOT Tilt-managed (see "services/ (deployed via Terraform, not Tilt)" below) — apply it once with `terraform apply` in `services/terraform` before `tilt up`, so its Jobs (Vault provisioning, DB migrations) are already satisfied. Chart dependencies (e.g. `services/traefik/helm`, `services/authentik/helm`) aren't fetched by Tilt/Terraform — run `helm dependency update <chart-dir>` manually after editing a `Chart.yaml`'s `dependencies:`.
- `docker compose up` from repo root — largely vestigial at this point. Root `docker-compose.yml` `include:`s only `apps/docker-compose.yml`, which is currently empty; `services/*` has no compose files at all anymore (that migrated fully to Terraform/Helm, see below). Don't rely on this path for local dev — use `tilt up`.

## Architecture

### Workspace layout

- `services/*` — third-party infra run in-repo (Apollo router/gateway, Authentik, Kafka, Meilisearch, MinIO, Vault, Traefik, monitoring, Apicurio Registry, cert-manager + cert-manager-config + ca-distribution for in-cluster TLS). `adminer` was retired outright (replaced by Grafana, see `services/monitoring`), not migrated to helm. Redis and ClickHouse are gone from here too — per-server Redis now lives in each server's own `-infra` chart (see below); nothing replaced ClickHouse. Debezium was removed from here — CDC moved to a per-server Debezium Server instance, scaffolded via `turbo gen driver`'s Debezium extension into each server's own `-infra` chart, not a shared Kafka Connect cluster.
- `apps/servers/*` — backend microservices, each a thin composition root over the shared `packages/server` framework, generated via `turbo gen server`. A server with a database extension gets a sibling `apps/servers/<name>-infra` chart (Postgres/Redis/Debezium — see "Per-server infra" below). Currently empty — no servers scaffolded.
- `apps/mfe/*` — React Module Federation microfrontends (remote role), generated via `turbo gen web`. Currently empty — no remotes scaffolded.
- `apps/web/*` — Module Federation host / plain (non-MF) web apps, generated via `turbo gen web`. Currently empty — no apps scaffolded.
- `apps/{docs,mobile}` — docs site and mobile app. `apps/docs/Tiltfile` is a genuine placeholder (empty file).
- `apps/terraform/` — Terraform root for every server's `-infra` chart (Postgres/Redis/Debezium), mirroring `services/terraform`'s pattern. Deploys into two fixed, shared namespaces (`server-infra`, `server-apps`) rather than one namespace pair per server; collisions are avoided by prefixing every object name with the server's own name.
- `packages/*` — shared libraries: `server` (backend framework), `api` (shared GraphQL/API types, built with rslib), `config` (shared config), `script` (release tooling, CLI in `src/bin/`)
- `test/e2e/` — API-level end-to-end tests (Vitest), see `test/e2e/README.md`; `test/zap` is a separate OWASP ZAP compose setup, see `test/zap/README.md`
- `turbo/generators/` — Plop code generators, invoked via `bun run generate`

### services/ (deployed via Terraform, not Tilt)

`services/*` charts are applied once via `services/terraform` (`helm_release` per chart, `kube_context` defaults to `k3d-dev`) instead of being re-rendered by Tilt on every `tilt up` — a real Helm release is a k8s object like any other, so it survives a k3d cluster stop/start without redeploying. Run `terraform apply` there once per cluster; re-run only when a `services/*/helm` chart actually changes. `services/*` no longer has any `Tiltfile`.

### Tilt + Helm (primary local-dev runtime for apps/servers, apps/web, apps/mfe — none currently scaffolded)

Every `apps/servers/*`, `apps/web/*`, `apps/mfe/*` workspace owns a `helm/` chart (`Chart.yaml` + `values.yaml` + `templates/`) and a `Tiltfile`, included transitively from the root `Tiltfile` via `apps/Tiltfile`. `turbo gen server` / `turbo gen web` scaffold both automatically for new workspaces (`turbo/generators/templates/*/helm/` + `Tiltfile`), registering the new `Tiltfile` into its parent's include list. `apps/Tiltfile` includes all four of `apps/docs/Tiltfile`, `apps/servers/Tiltfile`, `apps/web/Tiltfile`, `apps/mfe/Tiltfile` — the last three currently just declare a shared Namespace object, since no workspace has been scaffolded under any of them yet.

Patterns established during the docker-compose → Tilt/helm migration:
- Simple single/multi-container infra (Meilisearch, MinIO, Apicurio Registry, Vault, Kafka) — hand-rolled charts, no upstream chart dependency; matches what the old compose file actually ran, nothing more.
- Infra with a real, trustworthy upstream chart (Traefik, Authentik, Apollo Router, cert-manager) — that chart as a `dependencies:` entry in `Chart.yaml` instead of reinventing its RBAC/CRDs/subcharts. `charts/` (the fetched dependency `.tgz`s) is gitignored; `Chart.lock` is committed. Apollo Router's `router.yaml`/`supergraph.graphql` config lives inline in `values.yaml` under the dependency's own schema, not `.Files.Get` — that chart takes config as values, not mounted files.
- A locally-built image (any generated server/frontend) — a `Dockerfile` + the workspace's `Tiltfile` calls `docker_build()`, referenced by tag from `helm/templates/*.yaml`.
- One-off provisioning tools (`rover`) — invoked directly (`rover supergraph compose`, see `packages/script/src/bin/compose-supergraph.ts`), not through Docker Compose; the `rover` CLI must be on `PATH` to run `bun run supergraph` locally.

### Per-server infra (`apps/servers/<name>-infra`, Terraform-applied, not Tilt)

`turbo gen driver`'s server extensions each scaffold a piece of an `apps/servers/<name>-infra` chart, deployed once via `apps/terraform` (same `helm_release`-per-chart pattern as `services/terraform`) rather than re-rendered by Tilt on every `tilt up`:
- `DatabaseGenerator` — Postgres + a Vault dynamic-credential `CronJob` (`db-provision-job.yaml`, re-mints creds on a schedule comfortably inside the lease TTL, patches the app's `Secret` and rolls its `Deployment`) instead of a static superuser password baked into a `ConfigMap`.
- `RedisGenerator` — same shape for Redis, via Vault dynamic ACL users.
- `DebeziumGenerator` — a per-server Debezium Server instance (one process per Postgres database captured), added on top of a Prisma-enabled server.

All `-infra` charts land in one shared `server-infra` namespace, and every app chart lands in one shared `server-apps` namespace (not a dedicated namespace pair per server) — collisions are avoided by prefixing every object name with the server's own name instead. Tilt's own `helm()` has no live cluster access, so each server's own `Tiltfile` shells out to `kubectl get secret ... -n server-infra` to read the already-Terraform-applied `dbPassword`/`redisPassword` and pass them into the app chart via `set=[...]` — `apps/terraform` must be applied (after `services/terraform`, since provisioning auths against `services/vault`) before that server's own `tilt up` works.

### Backend server framework (`packages/server`)

Every microservice under `apps/servers/*` is a small `index.ts` calling into `src/app.ts`, which composes a `ServerApp` (`packages/server/src/ServerApp.ts`) via a fluent builder:

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
- **Database** (`database/DbAdapter.ts`) — Prisma client wiring; `dbAdapter` can be a value (e.g. `new PgAdapter(databaseUrl)`, the generated default — static superuser creds) or an async factory, resolved before drivers start for adapters that need an async round trip to obtain credentials. Vault-backed dynamic Postgres credentials (`VaultPgAdapter`) were removed pending a redesign; `VaultTlsAdapter` (mTLS leaf certs for `GrpcDriver`/`ApolloDriver`) was removed too, same reason. Dynamic Vault credentials now land at the k8s level instead of in-app: each server's own `-infra` chart runs a `CronJob` that mints fresh Postgres/Redis creds, patches the app's `Secret`, and rolls its `Deployment` (see "Per-server infra" above) — the app itself still just reads `DATABASE_URL`/`REDIS_URL` from env via the plain `PgAdapter`. `TlsConfig` (the plain `{ca, cert, key}` shape `GrpcDriver`/`ApolloDriver`/`startStandaloneServerTls` take) stays in `database/TlsConfig.ts`, decoupled from however a cert gets obtained.

`stop()` reverses `run()`'s order: plugins stop, then drivers stop, then the DB disconnects.

### Code generators (`turbo/generators/`)

Plop-based scaffolding, registered in `turbo/generators/config.ts`:
- `ServerCodeGenerator` — `turbo gen server` scaffolds a new `apps/servers/<name>` from `templates/server` (including a `helm/` chart + `Tiltfile`), and registers its `Tiltfile` into `apps/servers/Tiltfile`'s include list.
- `FrontendCodeGenerator` — `turbo gen web` scaffolds `apps/web/<name>` or `apps/mfe/<name>` (including a `helm/` chart + `Tiltfile`), inferring host vs. remote Module Federation role from location, or a plain non-MF app. Also assigns a free dev port and registers the `Tiltfile` include.
- `ServerDriverGenerator` (`turbo gen driver`) — adds a protocol driver (gRPC, GraphQL Federation, Kafka, Cron) to an existing server; only offers drivers not already installed.
- `ServerExtensionGenerator` — three separate generators, each scaffolding its own `apps/servers/<name>-infra` chart piece (see "Per-server infra" above): `turbo gen database`, `turbo gen redis`, `turbo gen debezium` (the last requires the database extension already installed).
- `helpers.ts` — shared generator utilities: `copyWithSubstitutions` (Handlebars-templated file copy), `appendRootTiltfileInclude`, `wireHelmDeploymentConfigMap`, `findAvailableFrontendPort`.

Generator actions register through `plop.setActionType`, which is a single global registry keyed by name (not scoped per generator) — never reuse an action name across generators, it will silently overwrite the earlier registration.

Note: newly-scaffolded servers/frontends get a `helm/` chart + `Tiltfile` generated automatically (see "Tilt + Helm" above), not a `docker-compose.yml`. A server's database/redis/debezium extensions do generate Terraform-applied output (its `-infra` chart, picked up by `apps/terraform`'s `fileset` glob) — that's the one place scaffolding targets Terraform instead of Tilt.

---

## SDLC System

This project uses a complete autonomous SDLC system.
Skills: .claude/skills/ | Commands: .claude/commands/

### Edward's Approval Commands (run these yourself)
/start "{feature}"               — SDLC entry point: begins planning
/kickoff v{X}.{Y}.{Z}           — approve sprint start, creates all branches
/approve-story KAN-{N}          — approve story merge + UAT deployment
/release-staging v{X}.{Y}.{Z}   — approve staging release
/release-production v{X}.{Y}.{Z} — approve production release

Situational:
/rollback v{X}.{Y}.{Z}          — production failure recovery
/escalate KAN-{N}               — surface decision to Edward

### Phase Structure
Phase 1: Discovery & Planning
Phase 2: Development
Phase 3: UAT (per story, ephemeral ArgoCD namespace)
Phase 4: Staging (full release, QA performance + stress)
Phase 5: Release (production deployment)
Phase 6: Retrospective

### Branch Hierarchy
release/v{X}.{Y}.{Z}
└── us/{KAN-N}-{story}
    ├── feat/{KAN-N}-{feature}
    │   ├── task/{KAN-N}-{task}         ← developer (NEVER first — api/ goes first)
    │   ├── api/{KAN-N}-{schema}        ← Data Engineer (ALWAYS MERGES FIRST)
    │   ├── qa/{KAN-N}-{tests}          ← QA Engineer
    │   ├── security/{KAN-N}-{config}   ← Security (feature-level)
    │   └── bugfix/{KAN-N}-{fix}        ← feature-level bugs
    ├── security/{KAN-N}-{config}       ← story-level security
    ├── devops/{KAN-N}-{infra}          ← story-level DevOps
    └── bugfix/{KAN-N}-{fix}            ← story-level bugs

### Hard Sequencing Rules (NEVER violate)
1. api/ branch MUST merge to feat/ BEFORE any task/ branches start
2. Data Engineer api-type-generation MUST complete before devs start
3. Backend Developer MUST complete + PR merged before Frontend/Mobile integrate
4. Security compliance-code-review MUST clear BEFORE PM adds uat-ready label
5. /approve-story requires ALL labels: qa: uat-approved, po: uat-approved, security: cleared

### Kanban Conventions
Tool: fulsomenko/kanban (kanban-cli)
File: .kanban/boards.json (committed to repo)
Branch → Card sync: GitHub Actions auto-syncs PR state → kanban card

Card types:
  type: epic | story | feature | task | api | qa | security | devops |
  bug-feature | bug-story | bug-release | hotfix | tech-debt | risk

### UAT Convention
PM adds uat-ready label → ArgoCD creates uat-{branch-slug} namespace
QA + PO test in PARALLEL at uat-{KAN-N}.uat.internal
PM removes uat-ready label → namespace auto-destroys

### SonarQube Quality Gates
Blocker + Critical + Major → PR blocked, fix current sprint
Minor + Info → warning, backlog
New code coverage ≥ 80% | Overall coverage ≥ 70%
Security rating ≥ A | Zero new vulnerabilities

### Performance SLAs (Staging — hard floors)
GraphQL query:    p99 ≤ 500ms
GraphQL mutation: p99 ≤ 1000ms
gRPC call:        p99 ≤ 200ms
Kafka consumer:   p99 ≤ 100ms

### Scaffolding Rules (NEVER violate)
ALWAYS use bun turbo gen — NEVER scaffold manually.
Backend: server → then router/usecase/repository (level 2).
Frontend/Mobile: webapp → module → page/component/hook/usecase.
Class generation order: repository → usecase → router → wire in app.ts

### Generated Code (NEVER EDIT THESE)
packages/api/src/generated/
apps/servers/*/generated/prisma/

Regenerate after:
.proto changes    → bun run gen
.graphql changes  → bun run gen
schema.prisma     → bun run gen
After graphql:    → bun run supergraph

### Environment Split
Local (docker compose):     PostgreSQL, Redis per service
SIT cluster (shared):       Kafka, Authentik, Apicurio, Vault, Traefik
All devs point at SIT for shared infra — never run locally.
Debezium: local docker compose but POINTS AT SIT Kafka.

### Local ZAP Scan (before any PR with public-facing endpoints)
cd test/zap && docker compose run zap-baseline

### Docs Convention
Technical Writer writes alongside PRs (same PR as code).
Writes ONLY to apps/docs/src/content/internal/latest/
Never writes to openspec/ or contracts/.

### Agent Portability Note
Skills in .claude/skills/ are agent-agnostic SOPs.
Future migration: copy to .opencode/skills/ for other coding agents.
Never use Claude-specific language in skill files.
