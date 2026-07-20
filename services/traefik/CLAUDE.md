# services/traefik

Docker Compose entry for [Traefik](https://traefik.io/) (`traefik:v3.3`) — the single reverse
proxy in front of every browser-facing service in this repo. Reachable on `:80`; every route is
`Host()`-based off `*.localhost` (resolves to `127.0.0.1` with no `/etc/hosts` edits needed on
every modern OS/browser).

There is no application code in this folder — just the Docker Compose stack, same as every other
`services/*` stack (`services/redis`, `services/meilisearch`, `services/kafka`,
`services/adminer`, `services/apollo`, `services/vault`, `services/authentik`).

## One dedicated `traefik` network, joined by every routed container

Every `services/*`/`apps/*`/`frontends/*` stack in this repo defines its **own** isolated bridge
network (see e.g. `services/redis/CLAUDE.md`) — there's no shared "public" network any of them
already sit on. Rather than have Traefik join all eight of those existing networks, this stack
owns a single dedicated `traefik` network (defined here, `driver: bridge`), and every *routed*
container joins it **in addition to** its own stack's network — e.g. `services/vault`'s `vault`
service is on `vault`, `adminer`, and `traefik` all at once; `services/kafka`'s `kafka-ui` is on
`kafka` and `traefik`, but `kafka`/`schema-registry` (not routed) stay on just `kafka`. Every file
that references `traefik` also redeclares it (empty) in its own top-level `networks:` — required
because Compose validates each included file as if it could be run standalone (confirmed: `docker
compose -f <file> config` fails with "refers to undefined network" without the redeclaration), same
reasoning as `services/vault/docker-compose.yml`'s own empty `adminer:` redeclaration.

This is a deliberate inversion of the more obvious "Traefik joins every network it needs to reach"
approach: `docker-compose.yml`'s own `networks:` list never has to change when a new service is
added or removed — onboarding a new routed service is entirely self-contained in that service's own
file (add `traefik` to its `networks:` + its own `traefik.enable=true` labels), never touching this
file at all.

## Routing is label-based, not a static config file

`--providers.docker=true` with `--providers.docker.exposedbydefault=false` means Traefik only
creates a router for a container that opts in with `traefik.enable=true` — every routed service in
this repo carries its own `traefik.http.routers.<name>.rule=Host(...)` +
`traefik.http.services.<name>.loadbalancer.server.port=<port>` labels directly in its own
`docker-compose.yml` (not centralized here). This keeps a service's routing config next to the
service itself, same locality principle as every other per-stack `CLAUDE.md` in this repo.

Current routes (no `apps/*`/`frontends/*` project exists right now — the prototype examples this
was verified against have since been removed; a future `turbo gen web` project picks up an
`Ingress`/route automatically, see the Kubernetes section's routed-set table below for how):

| Host | Service | Gated by `admin-auth`? |
|---|---|---|
| `graphql.localhost` | `services/apollo`'s router (`:4000`) | no |
| `auth.localhost` | `services/authentik`'s `authentik-server` (`:9000`) | no (has its own login) |
| `adminer.localhost` | `services/adminer` (`:8080`) | yes |
| `redis.localhost` | `services/redis`'s `redisinsight` (`:5540`) | yes |
| `search.localhost` | `services/meilisearch` (`:7700`) | yes |
| `vault.localhost` | `services/vault` (`:8200`) | yes |
| `kafka.localhost` | `services/kafka`'s `kafka-ui` (`:8080`) | yes |
| `grafana.localhost` | `services/monitoring`'s `grafana` (`:3000`) | no (has its own login) |
| `traefik.localhost` | Traefik's own dashboard (`api@internal`) | yes |

Every routed service **keeps** its existing host-port publish (`ports:` in its own
`docker-compose.yml`) — Traefik is additive, not a replacement for direct `localhost:<port>`
access. This is deliberate: it avoids touching every consumer of a fixed port today (e.g. a
frontend's own `PUBLIC_GRAPHQL_URL` build-arg baking in `http://localhost:4000/graphql` directly)
while still giving a single, memorable entry point per service. Direct port access and the
`*.localhost` Traefik route both work simultaneously.

## `admin-auth` — one shared basic-auth middleware, not per-service

`docker-compose.yml`'s `traefik` service itself declares
`traefik.http.middlewares.admin-auth.basicauth.users=<hash>` — every admin-tool router elsewhere
in the repo references it by name
(`traefik.http.routers.<name>.middlewares=admin-auth`). This works because Traefik's Docker
provider merges router/middleware/service labels from **every** container with
`traefik.enable=true` into one shared dynamic configuration; a middleware doesn't have to be
declared on the same container that consumes it. Centralizing it here (rather than duplicating the
`basicauth.users` value across six files) means rotating the credential is a one-line change.

`grafana` and `authentik` are **not** behind `admin-auth` — both already gate themselves with
their own login (Grafana's admin user, Authentik's whole reason for existing), so a second basic
auth prompt in front would be redundant friction, not defense-in-depth. Every other admin tool
here (Adminer, RedisInsight, the Meilisearch dashboard, Vault, Kafka UI) either has no auth at all
or a single static key, so `admin-auth` is the interim gate for those. **Swap this for Authentik's
own `forward-auth` middleware once `servers/auth`'s Authentik integration matures past `servers/
auth` itself** (see root `CLAUDE.md`'s services list — Authentik is "standalone for now, no
integration into `server` yet") — a per-service basic-auth password is not the end state, just
what's available before that integration exists.

- The `admin-auth` htpasswd (`apr1`) hash is inlined directly in the `basicauth.users` label in
  `docker-compose.yml`, **not** pulled from a `.env` file via `${VAR}` — Compose interpolates an
  env-file value a *second* time when substituting it into a label, so a literal `$` inside the
  hash (`$apr1$...`) gets misread as yet another `${VAR}` reference and silently resolves to an
  empty string (confirmed by inspecting the label actually applied to the running container, not
  just `docker compose config`'s printed output — that command's own escaped-`$$` display doesn't
  reveal the bug). A hash written directly in the compose file's own label value only passes
  through Compose's interpolation once, so `$$`-escaping there produces the correct single `$` at
  runtime. Default is user `admin` / password `admin` (`openssl passwd -apr1 admin`) — regenerate
  via `openssl passwd -apr1` and replace the label's hash (re-escaping `$` as `$$`) before anything
  but local dev, same "placeholder, generate a real one beyond a throwaway stack" convention as
  `services/vault`'s dev root token / `services/authentik`'s `AUTHENTIK_SECRET_KEY`.
- The Docker socket mount (`/var/run/docker.sock:ro`) is how the Docker provider discovers
  containers/labels at all — read-only, since Traefik only needs to observe container state, never
  mutate it (unlike Authentik's worker, which deliberately omits the same mount entirely — see
  `services/authentik/CLAUDE.md` — because it isn't using Docker-based outposts).
- The dashboard is intentionally **not** exposed on the separate insecure `:8080` API port
  (`--api.insecure=false`) — it's routed through the same `web` entrypoint as everything else
  (`Host(\`traefik.localhost\`)`), behind `admin-auth`, so there's no unauthenticated door into
  Traefik's own runtime config.
- See the Kubernetes section below for the in-cluster equivalent — same routed hostnames, a
  meaningfully different mechanism (`Ingress`, not Docker labels), and a narrower routed set (no
  `admin-auth` equivalent in-cluster at all, not even for Vault/Meilisearch/Kafka UI/Adminer/
  RedisInsight — none of those have a k8s Service exposed to a browser in the first place; see
  `services/terraform/CLAUDE.md`'s own note on why those admin UIs are deliberately excluded from
  the k8s deployment entirely).

## Kubernetes

`services/traefik/helm` + `services/traefik/terraform` deploy Traefik into the same shared
`infra` namespace as `kafka`/`redis`/`apollo`/`meilisearch`/`vault`/`monitoring`/`authentik` (see
`services/terraform/CLAUDE.md`) — registered as `module "traefik"` in `services/terraform/main.tf`,
same shape as every other module there (no `kubernetes_namespace` resource of its own; takes
`namespace` as an input).

### A Kubernetes `Ingress`, not Docker labels — and no CRDs

There's no Docker socket to read labels from in-cluster, so routing here uses Traefik's
**Kubernetes Ingress provider** (`--providers.kubernetesingress=true`) instead: every routed
chart's own `templates/ingress.yaml` (or `*-ingress.yaml`) declares a standard
`networking.k8s.io/v1` `Ingress` object with `spec.ingressClassName: traefik` — same
"routing config lives next to the service, not centralized" locality principle as the
docker-compose side's per-service labels. `templates/ingressclass.yaml` registers the
`IngressClass` resource itself; Traefik's `--providers.kubernetesingress.ingressclass=traefik` flag
is what actually restricts it to only that class (the `IngressClass` object alone doesn't).

**Deliberately not using Traefik's own `IngressRoute`/`Middleware` CRDs** — the CRD provider would
give in-cluster parity with docker-compose's `admin-auth` basic-auth middleware, but installing
and lifecycle-managing Traefik's CRDs (a real Helm/Terraform wrinkle: CRDs generally need a
separate apply step, since Helm doesn't upgrade CRDs already installed via a chart's `crds/`
directory) buys nothing today — every admin tool that basic-auth actually gates in
docker-compose (Adminer, RedisInsight, the Meilisearch dashboard, Kafka UI) has **no Kubernetes
Service exposed to a browser at all** (see `services/terraform/CLAUDE.md`'s note on why they're
excluded from this cluster's deployment entirely). If any of those ever gets a real in-cluster
browser-facing Service, that's the point to revisit plain `Ingress` vs the CRD provider — not
before.

### Routed set (narrower than docker-compose's)

| Host | Chart | Ingress file |
|---|---|---|
| `graphql.localhost` | `services/apollo` | `helm/templates/ingress.yaml` |
| `grafana.localhost` | `services/monitoring` | `helm/templates/grafana-ingress.yaml` |
| `auth.localhost` | `services/authentik` | `helm/templates/server-ingress.yaml` |

No `apps/*`/`frontends/*` project exists right now (see the docker-compose routes note above) — a
frontend's `Ingress` is defined once in the shared generator template
(`turbo/generators/templates/frontend-deploy/helm/templates/ingress.yaml`, driven by a new
`values.yaml` key, `ingress.host`, defaulting to `{{ name }}.localhost`) so every future
`turbo gen web` project gets one automatically, overridable per-project via its own
`helm/values.yaml`.

Every routed Service **keeps** its existing access path unchanged — a frontend's `NodePort`,
`apollo-router`/`grafana`/`authentik-server`'s `ClusterIP` reachable via `kubectl port-forward`
(see root `CLAUDE.md`'s Kubernetes end-to-end testing runbook) — the `Ingress` is additive, same
"doesn't replace direct access" rule as the docker-compose side. A *single*
`kubectl port-forward -n infra svc/traefik 80:80` (using `*.localhost` `Host` headers) now stands
in for the runbook's three separate per-Service port-forwards — confirmed working end-to-end (see
the verification note below).

### RBAC — cluster-scoped; Secrets and Nodes are both required, not optional

`templates/clusterrole.yaml` + `templates/clusterrolebinding.yaml` grant a cluster-wide (not
namespace-scoped) `ClusterRole`, because the routed set spans multiple namespaces (`infra`, plus
whatever namespace each frontend's own `terraform/module` creates) — a plain `Role` bound only in
`infra` would leave Traefik blind to `Ingress` objects created anywhere else.

**`secrets` and `nodes` read access turned out to be required, contradicting this chart's first
draft.** That draft deliberately excluded `secrets` on the reasoning that nothing routed here sets
`spec.tls`, so TLS-cert lookups (the documented reason Traefik's own RBAC reference wants secret
access) would never fire. Verified against a real cluster that this reasoning was wrong in
practice: Traefik's Kubernetes Ingress provider starts Secret and Node informers **unconditionally**
as part of the same shared informer factory as the Ingress/Service/Endpoints informers — without
list/watch on both, cluster-wide, those reflectors fail continuously
(`secrets is forbidden ... at the cluster scope`, then, once that was fixed, the identical failure
for `nodes`), and the whole provider never reports its cache as synced. The practical symptom was
total, not partial: **every** route 404'd, including plain-HTTP ones with no TLS and no
node-topology dependency — not a degraded TLS-only feature. Both are now granted. This is a real
privilege — blanket read access to every Secret in every namespace, including Vault's and
Authentik's own credentials — accepted only because the alternative (no routing at all) is worse
for this prototype; revisit if this cluster ever needs a hard boundary around Traefik's own blast
radius.

Everything else stays scoped to what the Kubernetes Ingress provider actually needs beyond that:
`endpoints`/`endpointslices` (resolving an `Ingress`'s backend) and `ingressclasses`/`ingresses`/
`ingresses/status` (read + status update).

### Dashboard — a plain port, not a routed `Ingress`

Without the `IngressRoute` CRD, there's no way to route Traefik's own `api@internal` service
through a normal `Ingress` object (a vanilla `Ingress` backend must be a real Kubernetes `Service`
with real `Endpoints`, and the internal API isn't one). So unlike the docker-compose dashboard
(`Host(\`traefik.localhost\`)` behind `admin-auth`), the in-cluster dashboard is just served on its
own container port (`dashboardPort`, `8080`, `--api.insecure=true`) with `templates/service.yaml`
exposing it as `ClusterIP` only — never `NodePort` — so the only way to reach it is an explicit
`kubectl port-forward -n infra svc/traefik 8080:8080`, same trust model as every other admin UI in
this cluster (e.g. Vault, Meilisearch — reachable only via an explicit port-forward, never a
public NodePort).

### Verified end-to-end against a live minikube cluster

Confirmed working (historical run, against prototype app/frontend/server examples that have since
been removed — the underlying RBAC finding below still applies to whatever's routed today):
`bun run k8s:build` → `services/terraform` apply → root `terraform/` apply →
`kubectl port-forward -n infra svc/traefik 80:80`, then, for each `Host`, a real response
through Traefik:

- The host app / the remote → `200`
- `grafana.localhost` / `auth.localhost` → `302` (redirect to each app's own login, as expected)
- `graphql.localhost` — a bare `GET /` 404s (Apollo Router's own `supergraph.path: /graphql` +
  `homepage.enabled: false`, see `services/apollo/helm/files/router.yaml` — not a Traefik
  failure); `POST /graphql` with a GraphQL body returns a real response
  (`{"data":{"__typename":"Query"}}`), reaching Apollo Router correctly.

This is also what surfaced the Secrets/Nodes RBAC gap documented above — the chart's first draft
(no `secrets`/`nodes` in the `ClusterRole`) produced a 404 on **every** route, not a partial
failure, until `kubectl logs -n infra deployment/traefik` pointed at the two forbidden reflectors.
Fixed via `templates/clusterrole.yaml` + `helm upgrade traefik ./helm -n infra` (a template-only
change — same "`terraform apply` doesn't see local chart edits" gotcha as
`services/terraform/CLAUDE.md`'s own note, so a `helm upgrade` was required to actually land it,
not just editing the file).

Separately, on this same fresh cluster, that prototype server's pod crash-loops with
`VaultPgAdapter.fromEnv() requires VAULT_ROLE_ID, VAULT_SECRET_ID, VAULT_DB_ROLE and DB_NAME` —
expected on a brand-new Vault dev-mode instance that hasn't had `bun run vault:provision` run
against it yet (see `services/vault/CLAUDE.md`'s "every restart wipes all provisioning" section),
not a Traefik issue. It doesn't block anything above since nothing routed here depends on that
server being healthy.
