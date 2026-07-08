# Build context must be repo root:
#   docker build -f {{ location }}/{{ name }}/Dockerfile -t {{ name }} .

ARG BUN_VERSION=1.3.14
# This host has no remotes wired up yet (rsbuild.config.ts's `remotes: {}`) — once one is added
# by hand, add a matching ARG/ENV pair here too, mirroring frontends/*/Dockerfile's own
# PUBLIC_GRAPHQL_URL pattern, e.g.:
#   ARG SHOP_HOST=localhost
#   ARG SHOP_PORT=3002
# and set both as ENV in the builder stage below (see rsbuild.config.ts's remotes comment for
# what these need to resolve to once this host is deployed to k8s). Also add a matching
# --build-arg to this project's package.json "k8s:build" script once you do.

# ── builder ────────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder

WORKDIR /app

COPY package.json bun.lock* turbo.json ./
COPY packages ./packages
COPY {{ location }}/{{ name }} ./{{ location }}/{{ name }}

# Not --frozen-lockfile: bun.lock was generated against the full monorepo workspace set, but
# this build only copies the subset actually needed (packages + this project) — bun's freeze
# check requires exact workspace-membership parity with the lockfile and fails on that partial
# copy. Same reason servers/*/Dockerfile doesn't use it either.
RUN bun install --ignore-scripts

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
