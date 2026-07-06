# Build context must be repo root:
#   docker build -f frontends/frontend1/Dockerfile -t frontend1 .

ARG BUN_VERSION=1.3.14
# Rsbuild inlines PUBLIC_* env vars into the client bundle at *build* time (see
# src/config/env.ts), not at container start — a docker-compose `environment:` entry on the
# runtime container has no effect on this. Override via `docker build --build-arg` /
# docker-compose's `build.args:` instead (see docker-compose.yml).
ARG PUBLIC_GRAPHQL_URL=http://router:4000/graphql

# ── builder ────────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder

ARG PUBLIC_GRAPHQL_URL
ENV PUBLIC_GRAPHQL_URL=${PUBLIC_GRAPHQL_URL}

WORKDIR /app

COPY package.json bun.lock* turbo.json ./
COPY packages ./packages
COPY frontends/frontend1 ./frontends/frontend1

# Not --frozen-lockfile: bun.lock was generated against the full monorepo workspace set, but
# this build only copies the subset actually needed (packages + frontends/frontend1) — bun's
# freeze check requires exact workspace-membership parity with the lockfile and fails on that
# partial copy (confirmed: "lockfile had changes, but lockfile is frozen"). Same reason
# servers/*/Dockerfile doesn't use it either.
RUN bun install --ignore-scripts

# Root-level build (turbo run build) — builds packages/api's dist (frontend1 imports its
# generated GraphQL types) before frontend1's own "build" script (rsbuild build), same
# root-then-workspace order servers/demo1/Dockerfile relies on.
RUN bun run build

# ── runtime ────────────────────────────────────────────────────────────────────
# Stays on oven/bun (unlike servers/*/Dockerfile's ubuntu+compiled-binary runtime) because
# `bun run preview` (rsbuild preview, serving frontends/frontend1/dist/) is the Rsbuild CLI
# itself, a devDependency — there's no standalone binary to extract, so the runtime still needs
# Bun + the full node_modules, not just the built output. (A leaner static-file-server runtime —
# e.g. nginx — is future work.)
FROM oven/bun:${BUN_VERSION}-slim AS runtime

RUN groupadd --system frontend1 && useradd --system --gid frontend1 frontend1

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/frontends/frontend1 ./frontends/frontend1

WORKDIR /app/frontends/frontend1

USER frontend1

EXPOSE 3001

ENTRYPOINT ["bun", "run", "preview"]
