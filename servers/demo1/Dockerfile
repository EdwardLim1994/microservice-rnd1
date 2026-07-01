# Build context must be repo root:
#   docker build -f servers/demo1/Dockerfile -t demo1 .

ARG BUN_VERSION=1.3.14
ARG SERVER_NAME=demo1

# ── builder ────────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder

ARG SERVER_NAME

WORKDIR /app

COPY package.json bun.lock* turbo.json ./
COPY packages ./packages
COPY servers/${SERVER_NAME} ./servers/${SERVER_NAME}

RUN bun install --ignore-scripts

RUN bun run build:lib

WORKDIR /app/servers/"${SERVER_NAME}"

RUN  bun build ./index.ts \
    --compile \
    --target=bun-linux-x64 \
    --outfile=./"${SERVER_NAME}"

# ── migrate ────────────────────────────────────────────────────────────────────
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

ENTRYPOINT ["/app/demo1"]
