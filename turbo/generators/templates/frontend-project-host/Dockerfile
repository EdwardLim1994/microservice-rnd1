# Build context must be repo root:
#   docker build -f {{ location }}/{{ name }}/Dockerfile -t {{ name }} .

ARG BUN_VERSION=1.3.14
# Keep in sync with root package.json's "turbo" dependency version.
ARG TURBO_VERSION=2.10.3
# This host has no remotes wired up yet (rsbuild.config.ts's `remotes: {}`) — once one is added
# by hand, add a matching ARG/ENV pair here too, mirroring frontends/*/Dockerfile's own
# PUBLIC_GRAPHQL_URL pattern, e.g.:
#   ARG SHOP_HOST=localhost
#   ARG SHOP_PORT=3002
# and set both as ENV in the builder stage below (see rsbuild.config.ts's remotes comment for
# what these need to resolve to once this host is deployed to k8s). Also add a matching
# --build-arg to this project's package.json "k8s:build" script once you do.

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

COPY --from=pruner /app/out/full/ .

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
