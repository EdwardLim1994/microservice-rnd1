
# services/terraform

Root Terraform config for Kafka + Schema Registry, Redis, and Apollo Router — shared,
always-on infrastructure, deployed and torn down as one unit, **never** by the app-aggregating
`terraform/` at the repo root. Adminer, kafka-ui, and redisinsight are deliberately excluded
(debugging UIs, not runtime dependencies of anything).

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
namespace, per Service in that namespace (the same mechanism that produces `DEMO1_PORT` etc. on
`servers/demo1`'s pods). Our own `schema-registry` Service therefore injects
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

**`demo1`'s `routing_url` has been hand-patched for in-cluster use; `demo2` has not.**
`servers/demo1` is now deployed to k8s (namespace `demo1`, Service `demo1` on `4001`/`5001`), so
`helm/files/supergraph.graphql`'s `DEMO1 @join__graph` URL was changed from the docker-compose
hostname (`http://demo1:4001`) to the cross-namespace Service FQDN
(`http://demo1.demo1.svc.cluster.local:4001`) — confirmed working: `{ demo1 { id } }` through the
router returns real data. This was a **manual edit of the copied chart file**, not a
`bun run supergraph` recompose — `compose_supergraph.sh.ts` spawns each subgraph server as a local
process and waits for its ready log line, which only works for servers actually reachable/runnable
from wherever the script runs, not from inside the `infra` namespace. Re-applied via
`helm upgrade apollo-router ./helm -n infra` + `kubectl rollout restart deployment apollo-router -n
infra` (a ConfigMap volume mount needs a pod restart to pick up new content, plan-invisible per the
note above).

`demo2` is **not** deployed to k8s at all (no `servers/demo2/terraform`/`helm` yet) — its
`join__graph` URL still points at `http://demo2:4002` and will fail if queried. This only matters
for queries touching demo2-extended fields; `demo1`'s own fields resolve fine. Deploying `demo2`
and fixing this is a separate follow-up, along with updating `servers/demo1`'s Helm values to
point at in-cluster Kafka/Redis addresses instead of `host.minikube.internal` (still docker-compose
based today).

## Apollo Router needs a `kubectl port-forward` too — it's `ClusterIP`, and browsers reach it directly

`services/apollo/helm`'s Service is `ClusterIP` (unlike frontend Services, which are `NodePort`)
since Router traffic in production would normally go through backend-to-backend or an ingress —
but `frontends/frontend1`'s `PUBLIC_GRAPHQL_URL` is a browser-facing address baked at image build
time, so *something* browser-reachable has to exist at that address during local testing. Forgetting
this port-forward was the actual first symptom reported ("remote page cannot fetch data") — the
browser had nothing at `localhost:4000` to connect to. See the root `CLAUDE.md`'s end-to-end runbook
for the full set of port-forwards a WSL2/Windows-browser dev loop needs.
