# Build context must be repo root:
#   docker build -f frontends/mfe1/Dockerfile -t mfe1 .

ARG BUN_VERSION=1.3.14
# Rsbuild inlines PUBLIC_* env vars into the client bundle at *build* time (see
# src/config/env.ts), not at container start — a docker-compose `environment:` entry on the
# runtime container has no effect on this. Override via `docker build --build-arg` /
# docker-compose's `build.args:` instead (see docker-compose.yml).
ARG PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
# This remote's own public-facing address, baked into dist/mf-manifest.json's publicPath (via
# rsbuild.config.ts's output.assetPrefix) — a consuming host resolves this remote's asset URLs
# against it, so it must match wherever this remote is actually reachable from a browser: the
# NodePort address or a `kubectl port-forward` target port, not this remote's internal dev port
# (3001) unless that happens to be the same number. See frontends/frontend1/rsbuild.config.ts
# for the full story on why this exists (RUNTIME-008 / "Unexpected token '<'" otherwise).
ARG MFE1_HOST=localhost
ARG MFE1_PORT=3001

# ── builder ────────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder

ARG PUBLIC_GRAPHQL_URL
ARG MFE1_HOST
ARG MFE1_PORT
ENV PUBLIC_GRAPHQL_URL=${PUBLIC_GRAPHQL_URL}
ENV MFE1_HOST=$MFE1_HOST
ENV MFE1_PORT=$MFE1_PORT

WORKDIR /app

COPY package.json bun.lock* turbo.json ./
COPY packages ./packages
COPY frontends/mfe1 ./frontends/mfe1

# Not --frozen-lockfile: bun.lock was generated against the full monorepo workspace set, but
# this build only copies the subset actually needed (packages + this project) — bun's freeze
# check requires exact workspace-membership parity with the lockfile and fails on that partial
# copy. Same reason servers/*/Dockerfile doesn't use it either.
RUN bun install --ignore-scripts

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

RUN groupadd --system mfe1 && useradd --system --gid mfe1 mfe1

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/frontends/mfe1 ./frontends/mfe1

WORKDIR /app/frontends/mfe1

USER mfe1

EXPOSE 3001

ENTRYPOINT ["bun", "run", "preview"]
