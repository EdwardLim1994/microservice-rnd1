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
- `bun run k8s:build` — builds workspace Docker images for the local cluster (k3d: `k3d image import` still needed to get a locally-built image into the cluster, since nothing runs that automatically anymore — see "Helm" below)
- `bun run release:cut` / `release:bump-rc` / `release:promote` / `release:hotfix` / `release:touched-apps` — release flows, all implemented in `packages/script/src/bin/release-manager.ts`
- No local-dev orchestrator currently wires up `apps/servers/`, `apps/web/`, `apps/mfe/` — each workspace still owns a `helm/` chart + `Dockerfile` (see "Helm" below), but building/deploying them locally is a manual `docker build` + `k3d image import` + `helm install` today. `services/*` is Terraform-applied (see "services/ (deployed via Terraform)" below) — apply it once with `terraform apply` in `services/terraform`, so its Jobs (DB migrations) are already satisfied. Chart dependencies (e.g. `services/traefik/helm`, `services/authentik/helm`) aren't fetched by Terraform — run `helm dependency update <chart-dir>` manually after editing a `Chart.yaml`'s `dependencies:`.
- `docker compose up` from repo root — largely vestigial at this point. Root `docker-compose.yml` `include:`s only `apps/docker-compose.yml`, which is currently empty; `services/*` has no compose files at all anymore (that migrated fully to Terraform/Helm, see below). Don't rely on this path for local dev.

## Architecture

### Workspace layout

- `services/*` — third-party infra run in-repo (Apollo router/gateway, Authentik, Kafka, Meilisearch, MinIO, Traefik, monitoring, Apicurio Registry, OpenBao, cert-manager + cert-manager-config for in-cluster TLS). `adminer` was retired outright (replaced by Grafana, see `services/monitoring`), not migrated to helm. Vault was removed too — it provided PKI (cert-manager's Issuer, now a plain `cert-manager.io` `selfSigned` type), OIDC login to its own UI (dropped, no replacement), and dynamic Postgres credentials (evaluated Infisical as a replacement, found its dynamic-secrets and OIDC-UI-login both require a paid self-hosted Enterprise license, and dropped the whole secrets-manager layer in favor of static per-service credentials set once via Terraform `set_sensitive` — see `services/terraform/variables.tf`'s `authentik_postgres_password`). `services/ca-distribution` (served Vault's root CA for LAN devices to trust) went with it — no CA hierarchy left to distribute under a self-signed Issuer. `services/openbao` is a later, deliberately narrower addition: a Linux Foundation fork of Vault (MPL-2.0, dynamic secrets free in core, unlike Infisical), scoped to **app-level secrets only** (API keys, JWT signing keys, third-party creds for `apps/servers/*` — see the `secrets` extension generator below) — never DB/Redis credentials, which stay static per the paragraph above. Redis and ClickHouse are gone from here too — per-server Redis now lives in each server's own `-infra` chart (see below); nothing replaced ClickHouse. Debezium was removed from here — CDC moved to a per-server Debezium Server instance, scaffolded via `turbo gen driver`'s Debezium extension into each server's own `-infra` chart, not a shared Kafka Connect cluster.
- `apps/servers/*` — backend microservices, each a thin composition root over the shared `packages/server` framework, generated via `turbo gen server`. A server with a database extension gets a sibling `apps/servers/<name>-infra` chart (Postgres/Redis/Debezium — see "Per-server infra" below). Currently empty — no servers scaffolded.
- `apps/mfe/*` — React Module Federation microfrontends (remote role), generated via `turbo gen web`. Currently empty — no remotes scaffolded.
- `apps/web/*` — Module Federation host / plain (non-MF) web apps, generated via `turbo gen web`. Currently empty — no apps scaffolded.
- `apps/{docs,mobile}` — docs site and mobile app.
- `apps/terraform/` — Terraform root for every server's `-infra` chart (Postgres/Redis/Debezium), mirroring `services/terraform`'s pattern. Deploys into two fixed, shared namespaces (`server-infra`, `server-apps`) rather than one namespace pair per server; collisions are avoided by prefixing every object name with the server's own name.
- `packages/*` — shared libraries: `server` (backend framework), `api` (shared GraphQL/API types, built with rslib), `config` (shared config), `script` (release tooling, CLI in `src/bin/`)
- `test/e2e/` — API-level end-to-end tests (Vitest), see `test/e2e/README.md`; `test/zap` is a separate OWASP ZAP compose setup, see `test/zap/README.md`
- `turbo/generators/` — Plop code generators, invoked via `bun run generate`

### services/ (deployed via Terraform)

`services/*` charts are applied once via `services/terraform` (`helm_release` per chart, `kube_context` defaults to `k3d-dev`) — a real Helm release is a k8s object like any other, so it survives a k3d cluster stop/start without redeploying. Run `terraform apply` there once per cluster; re-run only when a `services/*/helm` chart actually changes.

### Helm (apps/servers, apps/web, apps/mfe — none currently scaffolded)

Every `apps/servers/*`, `apps/web/*`, `apps/mfe/*` workspace owns a `helm/` chart (`Chart.yaml` + `values.yaml` + `templates/`) and a `Dockerfile`, scaffolded together by `turbo gen server` / `turbo gen web` (`turbo/generators/templates/*/helm/`). There is currently no automated orchestrator for these: build the image (`docker build`), get it into the local cluster (`k3d image import`), and install/upgrade the chart (`helm install`/`helm upgrade`) by hand.

Patterns established during the docker-compose → Helm migration:
- Simple single/multi-container infra (Meilisearch, MinIO, Apicurio Registry, Kafka) — hand-rolled charts, no upstream chart dependency; matches what the old compose file actually ran, nothing more.
- Infra with a real, trustworthy upstream chart (Traefik, Authentik, Apollo Router, cert-manager) — that chart as a `dependencies:` entry in `Chart.yaml` instead of reinventing its RBAC/CRDs/subcharts. `charts/` (the fetched dependency `.tgz`s) is gitignored; `Chart.lock` is committed. Apollo Router's `router.yaml`/`supergraph.graphql` config lives inline in `values.yaml` under the dependency's own schema, not `.Files.Get` — that chart takes config as values, not mounted files.
- A locally-built image (any generated server/frontend) — a `Dockerfile`, built and imported into the local cluster by hand, referenced by tag from `helm/templates/*.yaml`.
- One-off provisioning tools (`rover`) — invoked directly (`rover supergraph compose`, see `packages/script/src/bin/compose-supergraph.ts`), not through Docker Compose; the `rover` CLI must be on `PATH` to run `bun run supergraph` locally.

### Per-server infra (`apps/servers/<name>-infra`, Terraform-applied)

`turbo gen driver`'s server extensions each scaffold a piece of an `apps/servers/<name>-infra` chart, deployed once via `apps/terraform` (same `helm_release`-per-chart pattern as `services/terraform`):
- `DatabaseGenerator` — Postgres, a static superuser password (Terraform-managed `random_password`, set once via `apps/terraform`'s own `set_sensitive`, same idiom as `services/terraform`'s `authentik_postgres_password`) read cross-namespace into the app chart's own `DATABASE_URL` Secret via a Helm `lookup` at render time — no provisioning Job, no rotation. A per-deploy Vault-minted dynamic credential was evaluated and dropped (see `services/*`'s own Vault-removal note above).
- `RedisGenerator` — same idea for Redis, simpler still: the Redis Deployment/Service/Secret all live directly in the app chart itself (no separate `-infra` chart piece needed), same static-password pattern.
- `DebeziumGenerator` — a per-server Debezium Server instance (one process per Postgres database captured), added on top of a Prisma-enabled server.
- `SecretsGenerator` (`turbo gen secrets`) — optional, app-level secrets only (API keys, JWT signing keys, third-party creds — never DB/Redis credentials). Wires a dedicated per-server `ServiceAccount` + `OpenBaoPlugin` (`packages/server/src/plugin/OpenBaoPlugin.ts`) into the app chart. Authenticates to `services/openbao` via Kubernetes auth (no static credential at all — just the pod's own already-mounted ServiceAccount token); one shared role + one identity-templated ACL policy (`secret/data/servers/{{identity.entity.aliases.<accessor>.metadata.service_account_name}}/*`) scopes every server to only its own KV v2 path automatically, so adding a new server needs no new OpenBao-side provisioning.

All `-infra` charts land in one shared `server-infra` namespace, and every app chart lands in one shared `server-apps` namespace (not a dedicated namespace pair per server) — collisions are avoided by prefixing every object name with the server's own name instead. `apps/terraform` has no ordering dependency on `services/terraform` — every DB/Redis credential is self-contained (Terraform-generated, no external provisioner to authenticate against).

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
- **Plugins** (`plugin/`) — server-lifecycle hooks (`onStart`/`onStop`) for external integrations: `AuthentikPlugin`, `RedisPlugin`, `MeilisearchPlugin`, `MinioPlugin`, `OtelPlugin`, `OpenBaoPlugin` (app-level secrets — KV v2 + Kubernetes auth against `services/openbao`, registers a `secrets` client into the DI container; wired via the optional `secrets` extension generator, see "Per-server infra" below — never used for DB/Redis credentials, those stay static).
- **DI container** — an `awilix` container (`InjectionMode.PROXY`) threaded through routers/interceptors/plugins; `.containers()` registers additional entries (e.g. repositories).
- **Database** (`database/DbAdapter.ts`) — Prisma client wiring; `dbAdapter` can be a value (e.g. `new PgAdapter(databaseUrl)`, the generated default — static superuser creds) or an async factory, resolved before drivers start for adapters that need an async round trip to obtain credentials. `VaultPgAdapter`/`VaultTlsAdapter` (dynamic Postgres credentials and mTLS leaf certs, respectively, both Vault-backed) were evaluated and dropped, not just deferred — each server's DB/Redis credential is a static, Terraform-managed password now (see "Per-server infra" above), and the app itself just reads `DATABASE_URL`/`REDIS_URL` from env via the plain `PgAdapter`, no adapter-level indirection needed. `TlsConfig` (the plain `{ca, cert, key}` shape `GrpcDriver`/`ApolloDriver`/`startStandaloneServerTls` take) stays in `database/TlsConfig.ts`, decoupled from however a cert gets obtained.

`stop()` reverses `run()`'s order: plugins stop, then drivers stop, then the DB disconnects.

### Code generators (`turbo/generators/`)

Plop-based scaffolding, registered in `turbo/generators/config.ts`:
- `ServerCodeGenerator` — `turbo gen server` scaffolds a new `apps/servers/<name>` from `templates/server` (including a `helm/` chart + `Dockerfile`).
- `FrontendCodeGenerator` — `turbo gen web` scaffolds `apps/web/<name>` or `apps/mfe/<name>` (including a `helm/` chart + `Dockerfile`), inferring host vs. remote Module Federation role from location, or a plain non-MF app. Also assigns a free dev port.
- `ServerDriverGenerator` (`turbo gen driver`) — adds a protocol driver (gRPC, GraphQL Federation, Kafka, Cron) to an existing server; only offers drivers not already installed.
- `ServerExtensionGenerator` — three separate generators, each scaffolding its own `apps/servers/<name>-infra` chart piece (see "Per-server infra" above): `turbo gen database`, `turbo gen redis`, `turbo gen debezium` (the last requires the database extension already installed).
- `helpers.ts` — shared generator utilities: `copyWithSubstitutions` (Handlebars-templated file copy), `wireHelmDeploymentConfigMap`, `findAvailableFrontendPort`.

Generator actions register through `plop.setActionType`, which is a single global registry keyed by name (not scoped per generator) — never reuse an action name across generators, it will silently overwrite the earlier registration.

Note: newly-scaffolded servers/frontends get a `helm/` chart + `Dockerfile` generated automatically (see "Helm" above), not a `docker-compose.yml`. A server's database/redis/debezium extensions do generate Terraform-applied output (its `-infra` chart, picked up by `apps/terraform`'s `fileset` glob).

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
SIT cluster (shared):       Kafka, Authentik, Apicurio, Traefik, OpenBao
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
