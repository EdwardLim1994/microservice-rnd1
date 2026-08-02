# microservice-rnd1

[![CI Verify](https://github.com/EdwardLim1994/microservice-rnd1/actions/workflows/ci-verify.yml/badge.svg)](https://github.com/EdwardLim1994/microservice-rnd1/actions/workflows/ci-verify.yml)
[![CI Sonar Main](https://github.com/EdwardLim1994/microservice-rnd1/actions/workflows/ci-sonar-main.yml/badge.svg)](https://github.com/EdwardLim1994/microservice-rnd1/actions/workflows/ci-sonar-main.yml)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=EdwardLim1994_microservice-rnd1&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=EdwardLim1994_microservice-rnd1)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=EdwardLim1994_microservice-rnd1&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=EdwardLim1994_microservice-rnd1)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=EdwardLim1994_microservice-rnd1&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=EdwardLim1994_microservice-rnd1)

R&D playground for a microservices platform: Apollo Federation GraphQL + gRPC backends, Kafka/Debezium CDC, Vault-issued credentials and mTLS, Module Federation frontends — all running locally on k3d via Tilt + Helm, provisioned once via Terraform.

## Table of contents

- [Structure](#structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Structure

Bun + Turborepo monorepo. See [`CLAUDE.md`](./CLAUDE.md) for the full architecture writeup (drivers/routers/plugins, code generators, per-server infra provisioning). Summary:

```
services/*         third-party infra (Traefik, Authentik, Kafka, Apollo Router, Vault,
                    Meilisearch, MinIO, Apicurio Registry, cert-manager, monitoring),
                    applied once via services/terraform
apps/servers/*      backend microservices (gRPC/GraphQL), one thin composition root each
                    over packages/server; apps/servers/<name>-infra holds that server's
                    own Postgres/Redis/Debezium, applied once via apps/terraform
apps/web/*          Module Federation host / plain web apps        (scaffolded, not yet built out)
apps/mfe/*          Module Federation remotes                      (scaffolded, not yet built out)
apps/{docs,mobile}  docs site, mobile app
packages/*          shared libs: server (backend framework), api, config, script (release tooling)
test/e2e/           Cypress + Vitest end-to-end tests
test/zap/           OWASP ZAP scan compose setup
turbo/generators/   Plop scaffolding (`bun run generate`)
```

## Prerequisites

- [Bun](https://bun.sh) `1.3.14` (pinned via `packageManager` in `package.json`)
- Docker
- [k3d](https://k3d.io), [kubectl](https://kubernetes.io/docs/tasks/tools/), [Helm](https://helm.sh)
- [Tilt](https://tilt.dev)
- [Terraform](https://developer.hashicorp.com/terraform)

## Installation

```sh
bun install

# a local k3d cluster (create one however you normally would, e.g.):
k3d cluster create dev

# chart dependencies aren't fetched automatically — run once, and again after editing
# any Chart.yaml's `dependencies:` (services/traefik, services/authentik, services/apollo, ...)
helm dependency update services/<chart>/helm
```

## Development

Two Terraform roots provision infra that Tilt itself can't (real Helm releases meant to survive a cluster stop/start, plus Vault-backed provisioning Jobs). Apply them once per cluster, in order — `apps/terraform` provisions each server's Postgres/Redis by authenticating against `services/vault`:

```sh
terraform -chdir=services/terraform apply
terraform -chdir=apps/terraform apply   # only after any apps/servers/<name>-infra chart exists

tilt up
```

`tilt up` runs `apps/servers/*` (the only workspaces currently wired into `apps/Tiltfile`'s includes — `apps/web`/`apps/mfe`/`apps/docs` are placeholder Tiltfiles not yet included). Re-run `terraform apply` in a `services/*` or `apps/terraform` root only when a chart under it actually changes — routine iteration is Tilt's job.

Other common commands (see [`CLAUDE.md`](./CLAUDE.md#commands) for the full list):

```sh
bun run dev              # all workspaces' dev, no cache
bun run build            # all workspaces
bun run test             # all workspaces; `cd` into one package + `bun run test` for just that one
bun run lint / format / check
bun run gen              # codegen (e.g. GraphQL) then rebuilds `api`
bun run generate         # turbo gen — scaffold a server/web app or add a driver/extension
bun run supergraph       # compose the Apollo Federation supergraph
bun run k8s:build        # build workspace images outside of Tilt
```

`docker compose up` still works as a kept-as-backup path (`services/*` no longer has compose-equivalents for everything — e.g. `adminer` was retired outright, not migrated).

## Troubleshooting

- **`tilt up` fails to read a server's DB/Redis password** — that server's `Tiltfile` shells out to `kubectl get secret <name>-db-secret -n server-infra`, which only exists after `terraform -chdir=apps/terraform apply` has run. Apply Terraform first.
- **`apps/terraform apply` fails with "connection refused" against `vault.infra.svc.cluster.local`** — `services/terraform` hasn't been applied yet, or its Vault release isn't ready. Apply `services/terraform` first; there's no `depends_on` across the two independent Terraform roots.
- **A `helm()` call in Tilt errors on a missing chart dependency** — run `helm dependency update <chart-dir>` for any chart whose `Chart.yaml` lists `dependencies:` (Traefik, Authentik, Apollo Router, cert-manager); `charts/*.tgz` is gitignored so this doesn't survive a fresh clone.
- **A locally-built image doesn't reflect a code change** — k3d/Tilt's `docker_build()` auto-imports into the cluster; if a live_update sync seems stuck, check the server's own `Tiltfile` `sync()`/`run()` rules rather than rebuilding the whole image.
- **A DB/Redis credential CronJob doesn't seem to be rotating** — check the `-infra` chart's own `dbProvision`/`redisProvision.schedule` in its `values.yaml`; dev-mode Vault also loses all lease state on every restart, so a freshly restarted Vault needs its next scheduled provisioning run before creds are valid again.
- **SonarCloud badges above show stale data** — they only update on `push: main` (`ci-sonar-main.yml`); a PR's own analysis is scanned by `ci-verify.yml` but doesn't move the badges until merged.
