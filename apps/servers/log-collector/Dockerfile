# Build context must be repo root:
#   docker build -f apps/servers/log-collector/Dockerfile -t log-collector .

ARG BUN_VERSION=1.3.14
ARG SERVER_NAME=log-collector
ARG BUN_TARGET=bun-linux-x64
# Keep in sync with root package.json's "turbo" dependency version.
ARG TURBO_VERSION=2.10.3

# ── pruner ─────────────────────────────────────────────────────────────────────
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

COPY --from=pruner /app/out/full/ .

RUN bun run build

WORKDIR /app/apps/servers/"${SERVER_NAME}"

# ── development ───────────────────────────────────────────────────────────────
FROM builder AS development

ENTRYPOINT ["bun", "run", "index.ts"]

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

ENTRYPOINT ["/app/log-collector"]
