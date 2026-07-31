# Build context must be repo root:
#   docker build -f servers/server1-grpc/Dockerfile -t server1-grpc .

ARG BUN_VERSION=1.3.14
ARG SERVER_NAME=server1-grpc
# x64, not arm64 — matches this repo's actual host/minikube node architecture (confirmed via
# `uname -m` and `kubectl get nodes -o jsonpath='{.status.nodeInfo.architecture}'`, both amd64).
# A mismatched target produces a binary that fails with "exec format error" at container start,
# not at build time — confirmed the hard way on servers/demo2/Dockerfile before this default was
# fixed here too. Override via --build-arg if generating for a different architecture.
ARG BUN_TARGET=bun-linux-x64
# Keep in sync with root package.json's "turbo" dependency version.
ARG TURBO_VERSION=2.10.3

# ── pruner ─────────────────────────────────────────────────────────────────────
# `turbo prune --docker` computes the subset of the monorepo this server actually depends on and
# splits it into out/json/ (package.json + lockfile only, for every workspace in that subset) and
# out/full/ (the same subset's real source) — see servers/demo1/Dockerfile for the full
# explanation of why (Docker layer caching: `bun install` below only reruns when a
# package.json/lockfile in the pruned subset actually changes, not on every source edit).
FROM oven/bun:${BUN_VERSION}-slim AS pruner

ARG SERVER_NAME
ARG TURBO_VERSION

WORKDIR /app

RUN bun add --global turbo@"${TURBO_VERSION}"

COPY . .

RUN turbo prune "${SERVER_NAME}" --docker

# ── installer ──────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS installer

WORKDIR /app

COPY --from=pruner /app/out/json/ .

RUN bun install --ignore-scripts

# ── builder ────────────────────────────────────────────────────────────────────
# Stops right after workspace deps (packages/server etc.) are built — every downstream stage
# needs their dist/ output (see packages/server/package.json's exports), but not every downstream
# stage needs this app's own binary compiled, so that step lives in its own "compiled" stage
# instead of here.
FROM installer AS builder

ARG SERVER_NAME

COPY --from=pruner /app/out/full/ .

# Only consumed by servers with the "database" extension (their own postinstall script runs
# `prisma generate`, which needs *a* DATABASE_URL to satisfy prisma.config.ts's env() check even
# though it never actually connects) — harmless no-op for servers without it. The real runtime
# value comes from the k8s Secret via envFrom, which overrides this (Pod env always wins over an
# image's own ENV).
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

RUN bun run build

WORKDIR /app/apps/servers/"${SERVER_NAME}"

# Explicit, not relying on the postinstall hook `bun install`/`bun run build` may or may not have
# actually triggered above — that path failed silently once already (DATABASE_URL missing,
# non-fatal to the overall build) and left an image with no generated/prisma/ at all, crashing at
# runtime instead of at build time. A dedicated RUN here fails the build loudly if this ever
# breaks again, instead of shipping a broken image.
RUN bunx prisma generate

# ── development ───────────────────────────────────────────────────────────────
# Runs index.ts directly via bun (no compile step) — for Tilt live_update: source edits land in
# the already-running container and bun re-executes them on the next request/restart, instead of
# waiting on a full `bun build --compile` per change like the "compiled"/"runtime" path below.
FROM builder AS development

ENTRYPOINT ["bun", "run", "index.ts"]

# ── migrate ──────────────────
# One-off stage: reuses `builder`'s bun + prisma CLI + copied schema/migrations.
# The `runtime` stage below only ships the compiled binary, so this is the only
# stage that can actually run `prisma migrate deploy`.
FROM builder AS migrate

ENTRYPOINT ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ── compiled ───────────────────────────────────────────────────────────────────
FROM builder AS compiled

ARG SERVER_NAME
ARG BUN_TARGET

RUN  bun build ./index.ts \
    --compile \
    --target="${BUN_TARGET}" \
    --outfile=./"${SERVER_NAME}"

# ── runtime ────────────────────────────────────────────────────────────────────
FROM ubuntu:25.10 AS runtime

ARG SERVER_NAME

RUN groupadd --system "${SERVER_NAME}" && useradd --system --gid "${SERVER_NAME}" "${SERVER_NAME}"

WORKDIR /app

COPY --from=compiled /app/apps/servers/${SERVER_NAME}/${SERVER_NAME} ./${SERVER_NAME}

RUN chmod +x ./"${SERVER_NAME}"

USER ${SERVER_NAME}

EXPOSE 4001 5001

ENTRYPOINT ["/app/server1-grpc"]
