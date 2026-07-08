# Build context must be repo root:
#   docker build -f servers/test1/Dockerfile -t test1 .

ARG BUN_VERSION=1.3.14
ARG SERVER_NAME=test1
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
FROM installer AS builder

ARG SERVER_NAME
ARG BUN_TARGET

COPY --from=pruner /app/out/full/ .

RUN bun run build

WORKDIR /app/servers/"${SERVER_NAME}"

RUN  bun build ./index.ts \
    --compile \
    --target="${BUN_TARGET}" \
    --outfile=./"${SERVER_NAME}"

# ── migrate ──────────────────
# One-off stage: reuses `builder`'s bun + prisma CLI + copied schema/migrations.
# The `runtime` stage below only ships the compiled binary, so this is the only
# stage that can actually run `prisma migrate deploy`.
FROM builder AS migrate

ENTRYPOINT ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ── runtime ────────────────────────────────────────────────────────────────────
FROM ubuntu:25.10 AS runtime

ARG SERVER_NAME

RUN groupadd --system "${SERVER_NAME}" && useradd --system --gid "${SERVER_NAME}" "${SERVER_NAME}"

WORKDIR /app

COPY --from=builder /app/servers/${SERVER_NAME}/${SERVER_NAME} ./${SERVER_NAME}

RUN chmod +x ./"${SERVER_NAME}"

USER ${SERVER_NAME}

EXPOSE 4001 5001

ENTRYPOINT ["/app/test1"]
