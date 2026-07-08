
# apps/web1/terraform

Same `module/` + thin-wrapper pattern as `servers/demo1/terraform` — see the root `terraform/CLAUDE.md`
for the general shape. `cd apps/web1/terraform && terraform apply` deploys standalone;
the root `terraform/` config calls `module/` directly to deploy it alongside everything else.

## PUBLIC_* config is not something this terraform config (or the Helm chart it deploys) can
## configure at deploy time

Unlike a server's env vars (injected at pod start, changeable per-deploy via `helm_release`
`set` blocks), any `PUBLIC_*` config (e.g. `PUBLIC_GRAPHQL_URL` on the remote/plain project
templates) is inlined into the client JS bundle by Rsbuild at **image build time** — see this
project's own `Dockerfile` comment and `src/config/env.ts`. Whatever value was baked in via
`docker build --build-arg PUBLIC_GRAPHQL_URL=...` is what every browser that loads this
deployment gets, permanently, until the image is rebuilt with a different value —
`terraform apply`/`helm upgrade` cannot change it by tweaking `values.yaml`, only by pointing
`image.app.tag` at a differently-built image.

For a browser on the same machine as this minikube + the repo root's docker-compose stack (the
expected local dev setup), build with `PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql`
(services/apollo's Router, published to the host) — **not** `http://router:4000/graphql` (that's
docker-compose's own container-to-container hostname, which means nothing to a browser or to
this pod). See `frontends/frontend1/terraform/CLAUDE.md` for the concrete example this was
modeled on.
