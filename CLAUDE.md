# microservice-rnd1

Bun + Turborepo monorepo prototyping a microservices architecture: multiple protocol drivers
(gRPC, GraphQL Federation, Kafka) sharing one framework (`packages/server`) and one generated-types
package (`packages/api`), backed by Docker Compose infra services.

## Layout

- `packages/server/` — the framework: `ServerApp` (fluent builder, awilix DI container), protocol
  drivers, routers, use cases, repositories, `PgAdapter`/Prisma wiring. See
  `packages/server/CLAUDE.md` — read this first, everything else builds on it.
- `packages/api/` — generated-only shared types (proto + GraphQL codegen output per server),
  committed to the repo, never hand-edited. See `packages/api/CLAUDE.md`.
- `packages/script/` — standalone tooling package, currently just `APIGenerator` (drives codegen
  into `packages/api`, run via every server's `"gen"` script pointing at the one shared
  `src/bin/generate-api.ts` entrypoint — no per-server wrapper file). See `packages/script/CLAUDE.md`.
- `servers/<name>/` — one server per microservice. Currently just `auth` (GraphQL-only, no DB —
  `signIn`/`signUp`/`signOut` mutations backed by `services/authentik/`, see
  `servers/auth/CLAUDE.md`); a fuller example combining gRPC + GraphQL + Kafka + Postgres
  (illustrated elsewhere in this repo's docs as `demo1`/`demo2`) doesn't exist today — scaffold one
  with `turbo gen server` (see `turbo/generators/templates/server/CLAUDE.md` for the standard shape
  it produces).
- `services/` — Docker Compose infra: `kafka` (broker + schema registry + UI), `apollo` (Apollo
  Router + supergraph composition script), `adminer` (DB admin UI), `redis` (password-protected
  Redis instance + `redis-commander` UI, consumed via `server`'s `RedisPlugin` — see
  `packages/server/CLAUDE.md`'s Plugins section for a concrete usage example), `meilisearch`
  (master-key-protected Meilisearch instance with its own built-in dashboard, consumed via
  `server`'s `MeilisearchPlugin` — see `packages/server/CLAUDE.md`'s Plugins section), `minio`
  (root-credential-protected MinIO instance with its own built-in web console, consumed via
  `server`'s `MinioPlugin` — see `packages/server/CLAUDE.md`'s Plugins section), `vault`
  (HashiCorp Vault, dev-mode single instance — issues short-lived per-server Postgres credentials
  via its database secrets engine + AppRole, consumed via `server`'s `VaultPgAdapter`; see
  `packages/server/CLAUDE.md`'s Database section and `services/vault/CLAUDE.md`), `debezium`
  (Kafka Connect worker running Debezium's Postgres connector — per-server Change Data Capture
  into Kafka, provisioned via an Ansible playbook the same shape as `vault`'s; see
  `services/debezium/CLAUDE.md`), `authentik` (server + worker, dedicated Postgres + Redis —
  standalone for now, no integration into `server` yet; see `services/authentik/CLAUDE.md`),
  `traefik` (reverse proxy fronting every browser-facing service — user-facing apps and
  admin-tool UIs alike in docker-compose via label-based `Host(*.localhost)` routing with admin
  tools additionally gated by a shared basic-auth middleware; a plain Kubernetes `Ingress` in
  k8s, narrower there since none of docker-compose's admin-tool UIs have a k8s Service to route
  to; see `services/traefik/CLAUDE.md`). Each has its own `CLAUDE.md`.
  `kafka`/`redis`/`apollo`/`meilisearch`/`minio`/`vault`/`debezium`/`authentik`/`traefik` (not `adminer`)
  also each have a `helm/` + `terraform/` for an independent
  Kubernetes deployment — see `services/terraform/CLAUDE.md`.
- `generators/*`, `apps/*`, `frontends/*` — declared in `package.json`'s `workspaces` for future
  use; none of the three currently has a project in it (a prototype example under `apps/`/
  `frontends/` was scaffolded, deployed, and later removed — see `terraform/CLAUDE.md` and the
  Kubernetes end-to-end testing section below for what it verified).
- `terraform/` — root Kubernetes deployment config, aggregating every app (`servers/**`,
  `frontends/**`, `apps/**`) into one `terraform apply`. Contains no resource logic of its own —
  see `terraform/CLAUDE.md` for the module-reuse pattern each app follows and the root-vs-per-app
  state ownership rule. `services/terraform/`
  is a **separate, independent** root for Kafka/Redis/Apollo Router (always-on shared infra,
  deployed/torn down as its own unit — never touched by this one) — see its own `CLAUDE.md`.
- `.github/workflows/` — CI/CD: PR verification (test/lint/format/SonarQube/Claude Code review),
  and branch-triggered release/prod/hotfix deploys implementing this repo's branching/tagging
  strategy (per-app semver + `-rcN` during UAT, a release-bundle version on `main`). See
  `docs/ci-cd.md` for the full workflow-to-branch map, required secrets, and known gaps.

Root `docker-compose.yml` just `include`s four centralized files — `services/docker-compose.yml`,
`servers/docker-compose.yml`, `frontends/docker-compose.yml`, `apps/docker-compose.yml` — there's
no compose config at the root itself. Each of those in turn `include`s every project's own
`<project>/docker-compose.yml` directly beneath it (e.g. `services/docker-compose.yml` includes
`./adminer/docker-compose.yml`, `./apollo/docker-compose.yml`, ...), so each of the four
directories manages its own compose membership independently instead of every project being listed
flat at the root. `turbo gen server`/`turbo gen web` register a newly-scaffolded project into its
own directory's centralized file automatically (`appendRootComposeInclude` in
`turbo/generators/helpers.ts`) — `turbo gen mobile` doesn't, since mobile apps (Expo) have no
Dockerfile/docker-compose.yml at all (see `.claude/CLAUDE.md`'s Selective Deployment section —
mobile is always `deploy: false`, an Expo pipeline placeholder). `frontends/` and
`frontends/` currently has no projects at all, so `frontends/docker-compose.yml` starts as
`include: []` until the first `turbo gen web` run appends an entry — `apps/` has one,
`apps/docs` (an Astro Starlight site, hand-wired rather than `turbo gen web`-scaffolded, since
that generator only produces Rsbuild/React projects), registered into `apps/docker-compose.yml`.

## Commands (Turborepo, run from repo root)

- `bun install` — installs all workspaces.
- `bun run build` — `turbo run build`, builds every `packages/*` library (`server`, `script`,
  `api`) via rslib. Only needed standalone for a one-off rebuild — `dev` (below) already runs this
  as a dependency, so it's not a required manual step before `bun dev`. `turbo.json`'s `build`
  task declares `"env": ["PUBLIC_*", "*_HOST", "*_PORT"]` — Turborepo v2 defaults to strict env
  mode, silently stripping any env var not listed here from the spawned build subprocess, even
  though it's a real OS env var in turbo's own process. Confirmed the hard way against a prototype
  Module Federation host app (since removed): its `rsbuild.config.ts`'s remote address
  (`<REMOTE_NAME>_HOST`/`<REMOTE_NAME>_PORT`, baked into the client bundle by Rsbuild at build
  time) was silently missing from the built bundle when built via `bun run build` at repo root
  (through turbo) — building directly inside that app's own directory (bypassing turbo) baked it
  correctly. Every frontend `Dockerfile`
  builds via the former path (`RUN bun run build` at repo root, before switching `WORKDIR` into
  the project), so this pattern must cover every client-bundle-baked env var any frontend project
  uses, present or future: `PUBLIC_*` (`frontends/*`'s `PUBLIC_GRAPHQL_URL` convention) and
  `*_HOST`/`*_PORT` (each Module Federation remote's own env var pair).
- `bun dev` — `turbo run dev` across all servers/packages/apps. `turbo.json`'s `dev` task declares
  `"dependsOn": ["^build"]`, so turbo builds each package's workspace dependencies (e.g. any
  `servers/*` project depends on `server`/`script`/`api`) to completion first, then starts the
  persistent `dev` watchers — no manual `bun run build` step needed first. Requires `turbo`'s
  native binary for your
  platform (see `packages/server/CLAUDE.md`'s Turborepo/environment note — WSL is the recommended
  path on Windows).
- `bun run gen` — `turbo run gen && turbo run build`, regenerates proto/GraphQL types into
  `packages/api` then rebuilds `server`/`script`/`api`. Per-server regeneration caveats (e.g. a
  Linux/WSL-specific `buf generate` gotcha for a gRPC-driven server) live in that server's own
  `CLAUDE.md`.
- `bun run test` — `turbo run test`, runs rstest across packages/servers that have it configured
  (NOT `bun test` — see `packages/server/CLAUDE.md`'s Testing section for why).
- `bun run supergraph` — `turbo run supergraph`, composes the Apollo Federation supergraph schema.
  See `services/apollo/CLAUDE.md`.
- `bun run k8s:build` — `eval "$(minikube docker-env)" && turbo run k8s:build`, builds every
  project's `docker build` for minikube (any project scaffolded by `turbo gen server`/
  `turbo gen web`, each of which gets its own `k8s:build` script) in one command, instead of
  running `docker build` by hand per project. The `eval` has to happen in the same shell invocation as `turbo run` (not
  just once, standalone, beforehand) since it sets `DOCKER_HOST`/`DOCKER_TLS_VERIFY`/
  `DOCKER_CERT_PATH` for that shell only — bundling both into one script means `bun run k8s:build`
  always targets minikube's own Docker daemon, never your host's. `turbo.json`'s `k8s:build` task
  lists those same three vars (plus `MINIKUBE_ACTIVE_DOCKERD`) in its own `env` array for the same
  strict-env-mode reason as `build`'s `PUBLIC_*`/`*_HOST`/`*_PORT` above — without it, turbo would
  strip them from the spawned `docker build` subprocess and it'd silently build against your host's
  Docker daemon instead of minikube's. Each project's own `package.json` `"k8s:build"` script holds
  its actual `docker build -f .../Dockerfile --build-arg ...` invocation (`cd ../..` first, since
  every Dockerfile's build context is the repo root) — edit that script directly if a project's
  build-args change (e.g. a different `kubectl port-forward` port).

## Kubernetes end-to-end testing (minikube)

Current status: `services/**` (Kafka, Redis, Apollo Router — `services/terraform/`) has been
deployed and verified in minikube on its own. `terraform/` (the app-aggregating root) currently has
no app to deploy — its prototype example (a gRPC+GraphQL+Kafka server, a Module Federation remote,
and its host app, illustrated elsewhere in this repo's docs as `demo1`/`frontend1`/`portal`) was
deployed and verified working together end-to-end, including a real federated GraphQL query
flowing browser → host → remote → Apollo Router → the gRPC server, before being removed (see
`terraform/CLAUDE.md`). The runbook below is the still-current procedure a new `turbo gen server`/
`turbo gen web` project follows to redo that; step 2's build targets and step 5's port-forwards
need updating to that new project's own name/ports (see its own `package.json`'s `"k8s:build"`
script for the exact values). A gRPC-driven server's Helm values pointing at docker-compose-based
Kafka/Redis addresses (`host.minikube.internal:*`) instead of the new in-cluster `services/**`
addresses is a known rewiring gap to fix when scaffolding one (see `services/terraform/CLAUDE.md`).

**You are on WSL2 with a Windows-side browser** — `minikube ip`:nodePort is unreachable from it
(only `localhost` auto-forwards WSL2→Windows). Every browser-facing Service needs its own
`kubectl port-forward` instead; see `terraform/CLAUDE.md` for why.

Runbook, from a cold cluster:

1. `minikube start --driver=docker` (or `minikube start` if already the default driver).
2. `bun run k8s:build` from repo root — builds every scaffolded project's image against minikube's
   own Docker daemon in one command (see the `Commands` section above for what this actually
   does). Each project's build-args (matching the `kubectl port-forward` targets in step 6) live
   in that project's own `package.json` `"k8s:build"` script — edit there, not here, if a port
   changes.
3. Deploy shared infra first (`services/terraform/` — separate state, must exist before any app
   that depends on it): `cd services/terraform && terraform apply`.
4. Deploy the apps (`terraform/` — separate state, aggregates every `module "<app>"` block added to
   its `main.tf`): `cd terraform && terraform apply`.
5. Port-forward every browser-facing Service (each in its own terminal, or backgrounded), e.g. for
   a gRPC+GraphQL server behind Apollo Router plus a Module Federation remote/host pair:
   ```bash
   kubectl port-forward -n infra svc/apollo-router 4000:4000
   kubectl port-forward -n <remote-namespace> svc/<remote-name> <remote-port>:<remote-port>
   kubectl port-forward -n <host-namespace> svc/<host-name> <host-port>:<host-port>
   ```
6. Open the host app's `http://localhost:<host-port>` — it should load, render the remote's
   federated component, and that component should successfully fetch data through the router from
   the backing server.

**If a pod gets deleted/restarted, its port-forward dies with it** — reconnects don't survive a
backing pod change; re-run the `kubectl port-forward` command for that Service.

**Alternative to step 5's three port-forwards: one to Traefik instead.** `services/terraform` also
deploys Traefik (see `services/traefik/CLAUDE.md`'s Kubernetes section), fronting Apollo Router/
Grafana/Authentik via `Ingress` objects keyed on the same `*.localhost` hostnames as
the docker-compose stack. `kubectl port-forward -n infra svc/traefik 80:80`, then hit
`http://graphql.localhost` etc. (with a
`Host` header, or directly if your resolver honors `*.localhost` — most modern browsers do)
instead of the three separate per-Service port-forwards above. Confirmed working end-to-end
against a real cluster.

**Chart edits need a manual push.** `terraform apply` doesn't detect local Helm chart file
changes (no pinned chart `version` — see `terraform/CLAUDE.md`); use
`helm upgrade <release> <chart-path> -n <namespace>` directly, then (for ConfigMap-mounted files
specifically, which don't hot-reload even after `helm upgrade`) `kubectl rollout restart
deployment <name> -n <namespace>`.

**Full teardown**, in reverse order — `terraform destroy` in `terraform/` then
`services/terraform/`, then `minikube delete` (wipes the cluster *and* its Docker image cache, so
step 2's `bun run k8s:build` needs rerunning next time) or `minikube stop` (preserves both, no
rebuild needed for a same-day retest).

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads `.env`, so don't use `dotenv` — except where a server's `prisma.config.ts`
  needs it explicitly outside Bun's own runtime (see that server's `CLAUDE.md`).

## Ansible (Vault provisioning only)

The only non-Bun tooling in this repo: `services/vault/ansible/` provisions Vault's database
secrets engine + AppRole auth per server (see `services/vault/CLAUDE.md`), using the
`community.hashi_vault` collection. **No local Python/ansible install needed** — it runs inside
`services/vault/docker-compose.yml`'s `ansible` service, a one-off tool container (gated behind
the `tools` Compose profile, so it never starts with a plain `docker compose up`) with
`ansible-core`/`hvac`/the collection baked in at build time.

Run per server via `bun run vault:provision` inside that server's own directory (after
`docker compose up` brings up both `vault` and that server's own Postgres) — see
`packages/server/CLAUDE.md`'s Database section for what this feeds into (`VaultPgAdapter.fromEnv()`).
That script just wraps `docker compose run --rm ansible ansible-playbook ...`; only rebuild the
image (`docker compose build ansible`) if `services/vault/ansible/requirements.yml` or its
`Dockerfile` changes.
