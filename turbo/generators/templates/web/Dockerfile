# Build context must be repo root:
#   docker build -f {{ location }}/Dockerfile -t {{ name }} .

ARG BUN_VERSION=1.3.14
ARG APP_NAME={{ name }}
# Keep in sync with root package.json's "turbo" dependency version.
ARG TURBO_VERSION=2.10.3

# ── pruner ─────────────────────────────────────────────────────────────────────
# `turbo prune --docker` computes the subset of the monorepo this app actually depends on and
# splits it into out/json/ (package.json + lockfile only, for every workspace in that subset) and
# out/full/ (the same subset's real source) — see apps/servers/*/Dockerfile for the full
# explanation of why (Docker layer caching: `bun install` below only reruns when a
# package.json/lockfile in the pruned subset actually changes, not on every source edit).
FROM oven/bun:${BUN_VERSION}-slim AS pruner

ARG APP_NAME
ARG TURBO_VERSION

WORKDIR /app

RUN bun add --global turbo@"${TURBO_VERSION}"

COPY . .

RUN turbo prune "${APP_NAME}" --docker

# ── installer ──────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS installer

WORKDIR /app

COPY --from=pruner /app/out/json/ .

RUN bun install --ignore-scripts

# ── builder ────────────────────────────────────────────────────────────────────
FROM installer AS builder

ARG APP_NAME

COPY --from=pruner /app/out/full/ .

RUN bun run build

WORKDIR /app/{{ location }}

# ── development ───────────────────────────────────────────────────────────────
# Runs the rsbuild dev server directly — for Tilt live_update: source edits land in the
# already-running container and rsbuild hot-reloads them, instead of rebuilding the image.
FROM builder AS development

EXPOSE 3000

# Not "bun run dev" (package.json's dev script is `rsbuild --open`) — --open tries to launch a
# real browser via xdg-open, which doesn't exist in this image and has nothing to open anyway
# inside a container. Calling rsbuild directly skips it; host-side `bun run dev` outside Docker
# still gets --open.
ENTRYPOINT ["bun", "run", "rsbuild", "dev"]

# ── production ─────────────────────────────────────────────────────────────────
# `dist/` is static output (rsbuild build) — nginx serves it directly, no bun runtime in prod.
# TLS/routing is Traefik's job upstream of this; nginx here only serves files.
FROM nginx:1.29-alpine AS production

ARG APP_NAME

COPY --from=builder /app/{{ location }}/dist/ /usr/share/nginx/html/
COPY {{ location }}/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
