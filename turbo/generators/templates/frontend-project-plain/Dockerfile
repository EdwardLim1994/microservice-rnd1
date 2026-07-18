# Build context must be repo root:
#   docker build -f {{ location }}/{{ name }}/Dockerfile -t {{ name }} .

ARG BUN_VERSION=1.3.14
# Rsbuild inlines PUBLIC_* env vars into the client bundle at *build* time (see
# src/config/env.ts), not at container start — a docker-compose `environment:` entry on the
# runtime container has no effect on this. Override via `docker build --build-arg` /
# docker-compose's `build.args:` instead (see docker-compose.yml). Left unset by default —
# src/config/env.ts falls back to deriving the GraphQL URL from whatever host the browser
# actually loaded this app from, which works from any network vantage point (localhost, a LAN
# IP, a Tailscale IP, ...) without a rebuild; a fixed value here only makes sense for a
# deployment where the GraphQL endpoint is NOT reachable at the same host as this app.
ARG PUBLIC_GRAPHQL_URL=
# Keep in sync with root package.json's "turbo" dependency version.
ARG TURBO_VERSION=2.10.3

# ── pruner ─────────────────────────────────────────────────────────────────────
# `turbo prune --docker` computes the subset of the monorepo {{ name }} actually depends on (the
# root lockfile/package.json still records every workspace, including the literal, non-glob "e2e"
# entry — a hand-picked partial COPY, e.g. packages/* + this project only, fails bun install with
# "Workspace not found "e2e"" even though this app never imports it, since bun validates the full
# lockfile-recorded graph, not just what this app happens to import — see apps/docs/Dockerfile /
# servers/auth/Dockerfile for the identical reasoning) and splits it into out/json/ (package.json
# + lockfile only) and out/full/ (the same subset's real source).
FROM oven/bun:${BUN_VERSION}-slim AS pruner

ARG TURBO_VERSION

WORKDIR /app

RUN bun add --global turbo@"${TURBO_VERSION}"

COPY . .

RUN turbo prune {{ name }} --docker

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

# {{ location }}/{{ name }}/.env (real, gitignored dev values — correct for a plain `bun run
# dev`, where the dev server and browser are on the same machine) still gets copied in via the
# pruned source tree above, and Bun auto-loads it when rsbuild build runs from that directory —
# overriding the Docker ENV set from PUBLIC_GRAPHQL_URL above regardless of it already being
# defined. Removed here, build-stage-only, so the build only ever sees the ARG-derived value
# (empty by default, letting src/config/env.ts's own runtime fallback take over) — doesn't touch
# the real .env this same source tree still carries into the runtime image below.
RUN rm -f {{ location }}/{{ name }}/.env

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

RUN groupadd --system {{ name }} && useradd --system --gid {{ name }} {{ name }}

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/{{ location }}/{{ name }} ./{{ location }}/{{ name }}

WORKDIR /app/{{ location }}/{{ name }}

USER {{ name }}

EXPOSE {{ port }}

ENTRYPOINT ["bun", "run", "preview"]
