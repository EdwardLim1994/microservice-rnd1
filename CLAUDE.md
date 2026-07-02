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
  into `packages/api`, wrapped by each server's `src/scripts/generate_api.sh.ts`). See
  `packages/script/CLAUDE.md`.
- `servers/<name>/` — one server per microservice, e.g. `demo1` (gRPC + GraphQL + Kafka producer,
  has a Postgres DB) and `demo2` (gRPC + GraphQL + Kafka consumer, GraphQL federation subgraph
  extending `demo1`'s type, no DB). `servers/demo1/CLAUDE.md`'s Layout section documents the
  standard shape a new server should follow.
- `services/` — Docker Compose–only infra, no application code: `kafka` (broker + schema registry
  + UI), `apollo` (Apollo Router + supergraph composition script), `adminer` (DB admin UI), `redis`
  (password-protected Redis instance + `redis-commander` UI, consumed via `server`'s `RedisPlugin` —
  see `servers/demo1/CLAUDE.md`'s Redis cache section for a concrete usage example). Each has its
  own `CLAUDE.md`.
- `generators/*`, `apps/*` — declared in `package.json`'s `workspaces` for future use; neither
  directory exists yet.

Root `docker-compose.yml` just `include`s every `services/*/docker-compose.yml` and
`servers/*/docker-compose.yml` — there's no compose config at the root itself.

## Commands (Turborepo, run from repo root)

- `bun install` — installs all workspaces.
- `bun run build` — `turbo run build`, builds every `packages/*` library (`server`, `script`,
  `api`) via rslib. Only needed standalone for a one-off rebuild — `dev` (below) already runs this
  as a dependency, so it's not a required manual step before `bun dev`.
- `bun dev` — `turbo run dev` across all servers/packages/apps. `turbo.json`'s `dev` task declares
  `"dependsOn": ["^build"]`, so turbo builds each package's workspace dependencies (e.g. `demo1`/
  `demo2` depend on `server`/`script`/`api`) to completion first, then starts the persistent `dev`
  watchers — no manual `bun run build` step needed first. Requires `turbo`'s native binary for your
  platform (see `packages/server/CLAUDE.md`'s Turborepo/environment note — WSL is the recommended
  path on Windows).
- `bun run gen` — `turbo run gen && turbo run build`, regenerates proto/GraphQL types into
  `packages/api` then rebuilds `server`/`script`/`api`. Per-server regeneration caveats live in that
  server's own `CLAUDE.md` (e.g. `servers/demo1/CLAUDE.md` documents a Linux/WSL-specific
  `buf generate` gotcha).
- `bun run test` — `turbo run test`, runs rstest across packages/servers that have it configured
  (NOT `bun test` — see `packages/server/CLAUDE.md`'s Testing section for why).
- `bun run supergraph` — `turbo run supergraph`, composes the Apollo Federation supergraph schema.
  See `services/apollo/CLAUDE.md`.

## Bun

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads `.env`, so don't use `dotenv` — except where a server's `prisma.config.ts`
  needs it explicitly outside Bun's own runtime (see that server's `CLAUDE.md`).
