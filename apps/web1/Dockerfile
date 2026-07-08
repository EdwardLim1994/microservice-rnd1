# Build context must be repo root:
#   docker build -f apps/web1/Dockerfile -t web1 .

ARG BUN_VERSION=1.3.14
# rsbuild.config.ts's `remotes.mfe1` reads process.env.MFE1_HOST at *build* time (Rsbuild inlines
# it into the client bundle, same mechanism as frontends/*/Dockerfile's own PUBLIC_GRAPHQL_URL —
# a docker-compose `environment:` entry on the runtime container has no effect on this) — see
# that config's remotes comment for what this needs to resolve to once this host is deployed to
# k8s (minikube ip, not localhost). mfe1's own dev port (3001) is hardcoded in rsbuild.config.ts
# rather than read from an env var, so there's no MFE1_PORT build-arg to pass here.
ARG MFE1_HOST=localhost

# ── builder ────────────────────────────────────────────────────────────────────
FROM oven/bun:${BUN_VERSION}-slim AS builder

ARG MFE1_HOST
ENV MFE1_HOST=$MFE1_HOST

WORKDIR /app

COPY package.json bun.lock* turbo.json ./
COPY packages ./packages
COPY apps/web1 ./apps/web1

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

RUN groupadd --system web1 && useradd --system --gid web1 web1

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web1 ./apps/web1

WORKDIR /app/apps/web1

USER web1

EXPOSE 3000

ENTRYPOINT ["bun", "run", "preview"]
