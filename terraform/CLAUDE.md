
# terraform

Root Terraform config that aggregates every app's Kubernetes deployment into one `terraform
apply`. Contains **no resource logic of its own** — each `module "<app>"` block here points at
that app's own `<location>/<app>/terraform/module` (e.g. `module "auth"` →
`servers/auth/terraform/module`, `module "docs"` → `apps/docs/terraform/module`), the same module
that app's own `<location>/<app>/terraform`'s thin per-app wrapper calls for standalone use. See
that module's `main.tf` for the actual `kubernetes_namespace`/`helm_release` resources. Currently
registers `auth` (`servers/auth`) and `docs` (`apps/docs`) — the rest of this doc describes the
pattern a new one follows, also illustrated with a since-removed prototype example
(`demo1`/`frontend1`/`portal`, later renamed `test1`/`mfe1`/`web1`) that was scaffolded, deployed,
and verified against this config before being removed.

## Adding a new app

Give `servers/<app>/terraform/` (or `frontends/<app>/terraform/`, `apps/<app>/terraform/`) the same
shape `turbo gen server`/`turbo gen web` scaffold automatically (see
`turbo/generators/templates/server/terraform` / `turbo/generators/templates/frontend-deploy/
terraform`):
- `module/` — the actual resources, no `provider` blocks (child modules shouldn't own provider
  config — see `providers.tf`'s comment in both this directory and the per-app one).
- `providers.tf` + `variables.tf` + `main.tf` (thin wrapper calling `./module`) — lets that app
  still be deployed standalone, independent of this root config.

Then add one `module "<app>" { source = "../servers/<app>/terraform/module" ... }` block to this
directory's `main.tf` — no resource definitions duplicated here, ever.

## Root vs. per-app state — pick one owner per app, never both

This config and each app's own `servers/<app>/terraform/` use **separate local state files** —
they don't share state automatically just because they call the same module. If both ever ran
`apply` against the same namespace/release name, the one applying second would try to create a
Helm release that already exists (owned by the other's state) and fail.

Once this root config manages an app, its state is migrated in with `terraform state mv
-state=../servers/<app>/terraform/terraform.tfstate -state-out=terraform.tfstate
module.<app>.<resource> module.<app>.<resource>` (once per resource) — confirmed against the
prototype `demo1`/`frontend1` example mentioned above. From then on, treat that app's own
`servers/<app>/terraform` (or `frontends/<app>/terraform`) as a template/reference for *new* apps,
not something to `apply` standalone anymore — its local state file for that app's resources is now
empty by design (moved here), so a stray `apply` there would try to recreate them from scratch
instead of erroring cleanly.

## Frontends are not servers — one real difference

A frontend's only "config" (`PUBLIC_GRAPHQL_URL`) is baked into its client JS bundle at *image
build time* by Rsbuild, not read from env vars at pod start — see
`turbo/generators/templates/frontend-deploy/terraform/CLAUDE.md`. Its `module/main.tf` therefore
only has an `image.app.tag` `set` block, nothing env-shaped — don't expect a frontend's terraform
module to grow `set` blocks the way a Kafka-producing server's did; there's nothing at deploy time
for it to configure.

Frontend Services are `NodePort`, not `ClusterIP` — a browser needs to reach a frontend directly
(the initial page load if it's a host, or a Module Federation remote's `mf-manifest.json`, fetched
client-side, not server-side) — a `ClusterIP` Service can't serve either outside `kubectl
port-forward`. In principle reachable at `minikube ip`:nodePort. See
`turbo/generators/templates/frontend-deploy/helm/values.yaml` for the nodePort-assignment scheme
every generator-created frontend follows, and that same template's `rsbuild.config.ts` comment for
how a host needs to reference a remote's address/nodePort (not its dev port) once deployed.

Every frontend chart also carries an `Ingress` (`helm/templates/ingress.yaml`, generated from
`turbo/generators/templates/frontend-deploy/helm/templates/ingress.yaml`), routed through the
shared Traefik deployed by `services/terraform` (see `services/traefik/CLAUDE.md`'s Kubernetes
section) — additive to the `NodePort` above, not a replacement for it. Its hostname comes from
`values.yaml`'s `ingress.host` (defaults to `<project-name>.localhost`; an app can override it to
match its own docker-compose route).

**On WSL2 with a Windows-side browser, `minikube ip`:nodePort is unreachable — use
`kubectl port-forward` instead.** `minikube ip` (the minikube Docker bridge IP, e.g.
`192.168.49.2`) lives inside WSL2's own network namespace; only `localhost` is auto-forwarded from
WSL2 to Windows. Confirmed hands-on: the browser couldn't load `http://$(minikube ip):30000` at
all. Fix used throughout local testing: `kubectl port-forward -n <ns> svc/<name> <port>:<port>`
for each browser-facing Service (a host app's own port, a remote's own port, plus `apollo-router`
on `4000` in the `infra` namespace — see `services/terraform/CLAUDE.md`), bound to `127.0.0.1` and
auto-forwarded to Windows. Each Module Federation remote/host's address baked into its bundle at
image build time (`<REMOTE_NAME>_HOST`/`<REMOTE_NAME>_PORT`, `PUBLIC_GRAPHQL_URL`) must then match
the port-forward's local port, not the NodePort — see this repo root's `CLAUDE.md` for the full
end-to-end runbook including exact build-arg values used.

**A Module Federation remote also needs `output.assetPrefix` set, not just `dev.assetPrefix`, or
its production build's `mf-manifest.json` bakes a root-relative `"/"` `publicPath`.** A consuming
host then resolves the remote's asset URLs against *its own* origin instead of the remote's —
surfaces as a Module Federation `RUNTIME-008` error / `Uncaught SyntaxError: Unexpected token '<'`
in the browser (the host fetches its own HTML instead of the remote's JS chunk). `dev.assetPrefix`
only affects `rsbuild dev`; the Dockerfile's actual runtime path is `rsbuild build` +
`rsbuild preview`, which only `output.assetPrefix` affects. See
`turbo/generators/templates/frontend-project-remote/rsbuild.config.ts` for the fix, baked into
every `turbo gen web` remote from scaffold time.

## `terraform apply` alone won't pick up a local chart's own file changes

`helm_release` resources here reference charts by local path (`chart = abspath(...)`), not a
repository + pinned `version` — Terraform's helm provider doesn't hash a local chart's file
contents for drift detection, only the arguments actually passed on the resource (`chart`,
`namespace`, `set` blocks). Editing `values.yaml`/`templates/*.yaml` directly (as opposed to
through a `set` block) produces **no plan diff at all**, even though the real chart changed —
confirmed hands-on switching a frontend's Service to NodePort: `terraform plan` reported "No
changes" until applied via `helm upgrade` directly. Bumping `Chart.yaml`'s own `version:` field is
good hygiene but doesn't fix this either, since the resource never pins `version`. Until this
config pins per-chart versions and passes them through as a variable (not done today — the whole
point of `image.app.tag` `set` blocks is to avoid needing a chart version bump for routine image
updates), a template-only change needs either a direct `helm upgrade <release> <chart-path> -n
<namespace>` or `terraform apply -replace=module.<app>.helm_release.<app>` to actually land.
