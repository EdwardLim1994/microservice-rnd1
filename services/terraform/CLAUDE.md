
# services/terraform

Root Terraform config for Kafka + Schema Registry, Redis, Apollo Router, Meilisearch, Vault,
Monitoring (Prometheus/Loki/Tempo/Grafana — see `services/monitoring/CLAUDE.md`), Authentik, and
Traefik (see `services/traefik/CLAUDE.md`'s Kubernetes section) — shared, always-on
infrastructure, deployed and torn down as one unit, **never** by the app-aggregating `terraform/`
at the repo root. Adminer, kafka-ui, and redisinsight are deliberately excluded (debugging UIs,
not runtime dependencies of anything, and — now that Traefik is in the picture — also not
reachable through it, since none of them have a Kubernetes Service exposed to a browser to route
to in the first place); Meilisearch's own built-in dashboard (`MEILI_ENV=development`) is likewise
not exposed by this config for the same reason. Grafana *is* exposed (unlike those debugging UIs)
since it's the actual point of the monitoring stack, not an incidental admin panel — reachable
both by its own `kubectl port-forward` and, now, through Traefik's `grafana.localhost` `Ingress`.

## Separate from the app-level `terraform/` on purpose

This state file is entirely independent of the repo-root `terraform/` that aggregates
`servers/**`/`frontends/**`/`apps/**`. That's the actual safety mechanism, not just organization:
nothing that can `apply`/`destroy` the app-level root can ever touch Kafka/Redis/Router, because
they simply aren't resources in that state. If these ever need tearing down, it's a deliberate,
separate `terraform destroy` run from here — never a side effect of an app deploy.

## Shared `infra` namespace — created once, here, not per-service

Unlike an app (each owns a dedicated namespace, created by its own module), these three
services deliberately **share one namespace** (`infra`), since they're deployed/torn down as a
single logical unit. `namespace.tf` creates it exactly once. Each per-service
`services/<name>/terraform/module` takes `namespace` as an input variable and does **not** create
it — three modules each creating a `kubernetes_namespace "infra"` resource pointing at the same
real namespace would conflict (409) on the 2nd and 3rd apply.

This also means each service's own standalone thin wrapper (`services/kafka/terraform/`, etc.)
does not create the namespace either — running one standalone assumes `infra` already exists
(via this aggregating root, or `kubectl create namespace infra` for one-off testing). This is a
deliberate deviation from the per-app pattern (see `terraform/CLAUDE.md`), forced by the shared
namespace requirement.

## In-cluster Kafka needs only one listener — no PLAINTEXT_HOST/PLAINTEXT_MINIKUBE equivalent

`services/kafka/docker-compose.yml` needs three listeners because it crosses two different
network boundaries (Docker-internal, host-machine, and pod→host via minikube — see its own
`PLAINTEXT_MINIKUBE` comment). Pure in-cluster pod-to-pod traffic has no such boundary: any pod,
in any namespace, resolves `kafka.infra.svc.cluster.local` and reconnects to it correctly once
Kafka's protocol redirects it there post-bootstrap. `services/kafka/helm`'s StatefulSet advertises
exactly that one address — genuinely simpler than the docker-compose config, not a corner cut.

## `enableServiceLinks: false` is required on the Schema Registry pod, not optional

Kubernetes auto-injects a `<SERVICE_NAME>_PORT=tcp://<ip>:<port>` env var into every pod in a
namespace, per Service in that namespace (the same mechanism that would produce e.g. `DEMO1_PORT`
on a server named `demo1`'s pods). Our own `schema-registry` Service therefore injects
`SCHEMA_REGISTRY_PORT` into the schema-registry pod — and the Confluent image's own entrypoint
(`/etc/confluent/docker/configure`) treats **any** non-empty `SCHEMA_REGISTRY_PORT` as the
deprecated `PORT` variable and exits 1 immediately, before printing a useful error (confirmed by
execing the entrypoint script directly inside a debug pod and reading its source — the failure
was completely silent otherwise, just "PORT is deprecated..." with no indication *why* that
variable was set). `enableServiceLinks: false` on the pod spec disables this injection entirely;
added to kafka/redis/apollo-router's pod specs too, defensively, even though only Schema
Registry's entrypoint was confirmed to actually crash over it.

## `terraform plan` doesn't see local chart file changes — same as `terraform/CLAUDE.md`'s note

Applies here too: `helm_release` resources reference charts by local path, no pinned `version`,
so Terraform's helm provider won't detect a `values.yaml`/`templates/*.yaml` edit as drift. Use
`helm upgrade <release> <chart-path> -n infra` directly for iterating on a chart, same as
documented for the app-level charts.

## Apollo Router's supergraph.graphql is a real copy, not a live reference

`helm/files/router.yaml` and `helm/files/supergraph.graphql` are copies of
`services/apollo/src/config/router.yaml` and `dist/supergraph.graphql` — Helm's `.Files.Get` can
only read files inside the chart's own directory tree, so they can't be referenced from the
actual source location directly. Re-copy manually after either changes (`bun run supergraph`
regenerates `dist/supergraph.graphql`).

**Historical finding, from a prototype federation subgraph deployed under the names `demo1`/`demo2`
(later renamed `test1`/`test2`, both since removed from the repo — see root `CLAUDE.md`'s Layout
section) — the underlying mechanics still apply to any real federation subgraph deployed here in
the future:** a subgraph's `routing_url` in `helm/files/supergraph.graphql` needs hand-patching for
in-cluster use once it's actually deployed to k8s — e.g. `demo1` was in namespace `demo1`, Service
`demo1` on `4001`/`5001`, so its `DEMO1 @join__graph` URL was changed from the docker-compose
hostname (`http://demo1:4001`) to the cross-namespace Service FQDN
(`http://demo1.demo1.svc.cluster.local:4001`) — confirmed working: `{ demo1 { id } }` through the
router returned real data. This was a **manual edit of the copied chart file**, not a
`bun run supergraph` recompose — `compose_supergraph.sh.ts` spawns each subgraph server as a local
process and waits for its ready log line, which only works for servers actually reachable/runnable
from wherever the script runs, not from inside the `infra` namespace. Re-apply via
`helm upgrade apollo-router ./helm -n infra` + `kubectl rollout restart deployment apollo-router -n
infra` (a ConfigMap volume mount needs a pod restart to pick up new content, plan-invisible per the
note above).

A subgraph never deployed to k8s at all (`demo2` in this historical example — no
`terraform`/`helm` for it) leaves its `join__graph` URL pointing at its docker-compose hostname,
which fails if queried; this only matters for queries touching that subgraph's own extended
fields, not the deployed subgraph's fields. Deploying every subgraph and pointing each one's Helm
values at in-cluster Kafka/Redis addresses instead of `host.minikube.internal` (still
docker-compose-based today, whenever a real server exists here again) remains a follow-up.

## Apollo Router needs a `kubectl port-forward` too — it's `ClusterIP`, and browsers reach it directly

`services/apollo/helm`'s Service is `ClusterIP` (unlike frontend Services, which are `NodePort`)
since Router traffic in production would normally go through backend-to-backend or an ingress —
but a frontend's `PUBLIC_GRAPHQL_URL` is a browser-facing address baked at image build time, so
*something* browser-reachable has to exist at that address during local testing. Forgetting
this port-forward was the actual first symptom reported ("remote page cannot fetch data") — the
browser had nothing at `localhost:4000` to connect to. See the root `CLAUDE.md`'s end-to-end runbook
for the full set of port-forwards a WSL2/Windows-browser dev loop needs.
