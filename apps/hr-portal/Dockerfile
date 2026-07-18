# Build context must be repo root:
#   docker build -f apps/hr-portal/Dockerfile -t hr-portal .

ARG BUN_VERSION=1.3.14
# Rsbuild inlines PUBLIC_* env vars into the client bundle at *build* time (see
# src/config/env.ts), not at container start — a docker-compose `environment:` entry on the
# runtime container has no effect on this. Override via `docker build --build-arg` /
# docker-compose's `build.args:` instead (see docker-compose.yml).
ARG PUBLIC_GRAPHQL_URL=http://router:4000/graphql
# Keep in sync with root package.json's "turbo" dependency version.
ARG TURBO_VERSION=2.10.3

# ── pruner ─────────────────────────────────────────────────────────────────────
# `turbo prune --docker` computes the subset of the monorepo hr-portal actually depends on (the
# root lockfile/package.json still records every workspace, including the literal, non-glob "e2e"
# entry — a hand-picked partial COPY, e.g. packages/* + this project only, fails bun install with
# "Workspace not found "e2e"" even though hr-portal never imports it, since bun validates the full
# lockfile-recorded graph, not just what this app happens to import — see apps/docs/Dockerfile /
# servers/auth/Dockerfile for the identical reasoning) and splits it into out/json/ (package.json
# + lockfile only) and out/full/ (the same subset's real source).
FROM oven/bun:${BUN_VERSION}-slim AS pruner

ARG TURBO_VERSION

WORKDIR /app

RUN bun add --global turbo@"${TURBO_VERSION}"

COPY . .

RUN turbo prune hr-portal --docker

# ── installer ──────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS installer

WORKDIR /app

COPY --from=pruner /app/out/json/ .

RUN bun install --ignore-scripts

# ── builder ────────────────────────────────────────────────────────────────────
FROM installer AS builder

ARG PUBLIC_GRAPHQL_URL
ENV PUBLIC_GRAPHQL_URL=${PUBLIC_GRAPHQL_URL}

COPY --from=pruner /app/out/full/ .

# Root-level build (turbo run build) — builds packages/api's dist (this app imports its
# generated GraphQL types) before this project's own "build" script (rsbuild build), same
# root-then-workspace order servers/demo1/Dockerfile relies on.
RUN bun run build

# ── runtime ────────────────────────────────────────────────────────────────────
# Stays on oven/bun (unlike servers/*/Dockerfile's ubuntu+compiled-binary runtime) because
# `bun run preview` (rsbuild preview) is the Rsbuild CLI itself, a devDependency — there's no
# standalone binary to extract, so the runtime still needs Bun + the full node_modules, not just
# the built output. (A leaner static-file-server runtime — e.g. nginx — is future work.)
FROM oven/bun:${BUN_VERSION}-slim AS runtime

RUN groupadd --system hr-portal && useradd --system --gid hr-portal hr-portal

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/hr-portal ./apps/hr-portal

WORKDIR /app/apps/hr-portal

USER hr-portal

EXPOSE 3000

ENTRYPOINT ["bun", "run", "preview"]
