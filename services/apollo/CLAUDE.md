# services/apollo

Docker Compose entry for the Apollo Router (`ghcr.io/apollographql/router`), fronting the
federation subgraphs on `:4000` (see `packages/server/CLAUDE.md`'s GraphQL federation section for
how a subgraph server builds its schema). Router config: `src/config/router.yaml`.
Env (`.env`, gitignored): `APOLLO_ROUTER_CONFIG_PATH`, `APOLLO_ROUTER_SUPERGRAPH_PATH`,
`APOLLO_ROUTER_HOT_RELOAD`, `APOLLO_ROUTER_CHECK`.

## Composing the supergraph

`bun run supergraph` (`src/scripts/compose_supergraph.sh.ts`) generates `dist/supergraph.graphql`,
which the router container mounts read-only (see `docker-compose.yml`'s `volumes:`):

- Reads `src/config/supergraph.yaml` for the list of subgraphs to compose — each entry needs a
  `routing_url` (where the *running* router sends requests, `http://<service>:<port>`) and a
  `schema.file` (a local path to that server's GraphQL SDL, used only at compose time).
- Only servers listed there expose a GraphQL subgraph — a gRPC-only server would never log GraphQL
  readiness and would hang the wait step below.
- Spawns `bun run index.ts` for each listed server locally (not in Docker) and waits for its GraphQL
  driver's ready log line before running `rover supergraph compose`, then kills all spawned
  processes.
- **Known bug**: the wait step checks each spawned process's stdout for the substring
  `"GraphQL running on"`, but every server's actual `onReady` log line is `"GraphQL server is
  running on ..."` (see a server's own `src/app.ts`) — the substring never matches, so
  `waitReady()` hangs indefinitely instead of proceeding once the subgraph is actually up. Fix by
  aligning the substring check with the real log text (or vice versa) before relying on
  `bun run supergraph`.
- `routing_url` in `supergraph.yaml` points at `http://<server>:<port>` (Docker service name) with a
  commented-out `http://host.docker.internal:<port>` alternative — same host-vs-Docker split
  documented in a server's own `CLAUDE.md`/`services/kafka/CLAUDE.md`, switch depending on whether
  the router is running in Docker or the subgraph servers are running on the host.

## Kubernetes deployment uses a hand-patched copy, not a recompose

`services/apollo/helm/files/supergraph.graphql` (mounted by the `infra`-namespace Router
deployment — see `services/terraform/CLAUDE.md`) is a **copy** of `dist/supergraph.graphql` with
each deployed subgraph's `join__graph` URL manually changed to the in-cluster Service FQDN
(`http://<serverName>.<serverName>.svc.cluster.local:4001`) instead of the docker-compose hostname.
Running `bun run supergraph` again will overwrite `dist/supergraph.graphql` with docker-compose URLs
and does **not** touch the helm copy automatically — re-copy and re-patch the affected `@join__graph`
line(s) by hand after any real schema change, then `helm upgrade apollo-router ./helm -n infra &&
kubectl rollout restart deployment apollo-router -n infra` (ConfigMap volume mounts don't
hot-reload, and Terraform's `helm_release` won't see the file diff at all — see
`services/terraform/CLAUDE.md`). A subgraph server never deployed to k8s leaves its URL unpatched.

## mTLS to subgraphs

Every subgraph in `src/config/supergraph.yaml` is reached over `https://`, with the Router
presenting its own Vault-issued client cert (mutual TLS — see `packages/server/CLAUDE.md`'s TLS
section and `services/vault/CLAUDE.md`'s PKI section for the full story). `src/config/router.yaml`'s
`tls.subgraph.subgraphs.<name>.*` keys point at `/etc/tls/{ca,cert,key}.pem`, written by
`bun run tls:provision` (`src/scripts/provision_tls.sh.ts`, using the same `VaultTlsAdapter` a
server's own boot code calls) — run this **before** `docker compose up`, same "spawn a script
before the real thing starts" ordering as `bun run supergraph`. Needs `services/apollo/ansible/
vars.yml` provisioned first (`bun run vault:provision`) — the Router has its own AppRole/TLS role
(`apollo-router-tls-role`), it isn't a `servers/*` project so it doesn't share one with any server.

In Kubernetes, there's no host-side pre-start step to run this from, so `helm/templates/
deployment.yaml`'s `vault-tls-init` initContainer does the equivalent Vault PKI issue call
(`curl` + `grep`/`sed` JSON extraction, not `jq` — `curlimages/curl` doesn't bundle it, see that
file's own `ponytail:` comment for the ceiling) directly against Vault's HTTP API, writing into an
`emptyDir` the main container mounts read-only at `/etc/tls`.

**Router config schema not yet verified against a live Router.** The `tls.subgraph.*` keys in both
`src/config/router.yaml` and `helm/files/router.yaml` are written from Apollo Router's documented
subgraph-TLS shape, not confirmed by actually booting `ghcr.io/apollographql/router:v2.15.0` with
them — verify (`docker compose up`, watch for a config-parse error) before relying on this beyond
local dev.

## Dependencies

- `@apollo/rover` — the `rover` CLI used by `compose_supergraph.sh.ts` (`--elv2-license=accept`
  is required non-interactively).
- `script` — only for `createFolder` (ensures `dist/` exists before writing the composed schema).
