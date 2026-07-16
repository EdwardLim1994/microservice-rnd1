# Build context must be repo root:
#   docker build -f apps/docs/Dockerfile -t docs .

ARG BUN_VERSION=1.3.14
# Keep in sync with root package.json's "turbo" dependency version.
ARG TURBO_VERSION=2.10.3

# ── pruner ─────────────────────────────────────────────────────────────────────
# `turbo prune --docker` computes the subset of the monorepo docs actually depends on (docs has no
# workspace:* deps of its own, but the root lockfile/package.json still records every workspace —
# a hand-picked partial COPY (packages/*, or a stub e2e/package.json) fails bun install with
# "Workspace dependency ... not found" for entirely unrelated workspaces, since bun validates the
# full lockfile-recorded graph, not just what a given app happens to import — see servers/auth/
# Dockerfile for the identical reasoning) and splits it into out/json/ (package.json + lockfile
# only) and out/full/ (the same subset's real source).
FROM oven/bun:${BUN_VERSION}-slim AS pruner

ARG TURBO_VERSION

WORKDIR /app

RUN bun add --global turbo@"${TURBO_VERSION}"

COPY . .

RUN turbo prune docs --docker

# ── installer ──────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS installer

WORKDIR /app

COPY --from=pruner /app/out/json/ .

RUN bun install --ignore-scripts

# ── builder ────────────────────────────────────────────────────────────────────
FROM installer AS builder

COPY --from=pruner /app/out/full/ .

RUN cd apps/docs && bun run build

# ── runtime ────────────────────────────────────────────────────────────────────
# Stays on oven/bun (unlike servers/*/Dockerfile's ubuntu+compiled-binary runtime) because
# `astro preview` is the Astro CLI itself, a devDependency — there's no standalone binary to
# extract, so the runtime still needs Bun + node_modules, not just the built `dist/` output. Same
# reasoning as turbo/generators/templates/frontend-project-plain/Dockerfile's runtime stage.
FROM oven/bun:${BUN_VERSION}-slim AS runtime

RUN groupadd --system docs && useradd --system --gid docs docs

# Astro's telemetry tries to write a config file under $HOME on first run — the "docs" system
# user has no writable home dir (useradd --system doesn't create one), which crashes `astro
# preview` outright at container start (EACCES). Standard practice for CI/containers anyway.
ENV ASTRO_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/docs ./apps/docs

WORKDIR /app/apps/docs

USER docs

EXPOSE 4321

# --host 0.0.0.0: astro preview binds localhost-only by default, unreachable from outside the
# container otherwise. Astro's own default port (4321), not this repo's frontend-generator port
# scheme (3000+) — docs isn't scaffolded by `turbo gen web`, so there's no PUBLIC_GRAPHQL_URL/dev
# port collision to avoid.
ENTRYPOINT ["bun", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4321"]
