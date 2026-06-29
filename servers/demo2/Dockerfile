# Build context must be repo root:
#   docker build -f servers/demo2/Dockerfile -t demo2 .

ARG BUN_VERSION=1.3.14
ARG SERVER_NAME=demo2

# ── builder ────────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION} AS builder

ARG SERVER_NAME

WORKDIR /app

COPY package.json bun.lock* turbo.json ./
# COPY packages/lib/package.json ./packages/lib/
# COPY packages/api/package.json ./packages/api/
# COPY servers/${SERVER_NAME}/package.json ./servers/${SERVER_NAME}/

COPY packages ./packages
COPY servers/${SERVER_NAME} ./servers/${SERVER_NAME}

RUN bun i
# --frozen-lockfile

RUN bun run build:lib

RUN cd servers/${SERVER_NAME} && \
    bun build ./index.ts \
    --compile \
    --target=bun-linux-x64 \
    --outfile=./${SERVER_NAME}

# ── runtime ────────────────────────────────────────────────────────────────────
FROM ubuntu:25.10 AS runtime

ARG SERVER_NAME

RUN groupadd --system ${SERVER_NAME} && useradd --system --gid ${SERVER_NAME} ${SERVER_NAME}

WORKDIR /app

COPY --from=builder /app/servers/${SERVER_NAME}/${SERVER_NAME} ./${SERVER_NAME}

RUN chmod +x ./${SERVER_NAME}

USER ${SERVER_NAME}

EXPOSE 4002 5002

ENTRYPOINT ["/app/demo2"]
