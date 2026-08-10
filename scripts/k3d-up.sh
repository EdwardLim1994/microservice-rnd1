#!/usr/bin/env bash
# Creates the local k3d cluster with k3s's bundled Traefik disabled — it ships its own
# IngressClass "traefik", which collides with services/traefik's own chart on `terraform apply`
# (see services/terraform/main.tf's helm_release.traefik). Host ports 8080/8443 map to Traefik's
# own pinned NodePorts 30080/30443 (services/traefik/helm/values.yaml), same as every OIDC
# redirect_uri/hostAlias in this repo already expects.
set -euo pipefail

NAME="${1:-dev}"

# --registry-create: without a registry attached, k3d never writes the "local-registry-hosting"
# ConfigMap (kube-public, KEP-1755) that a locally-built image needs to push to (and a chart's
# Deployment needs to pull from) without a real registry — with none, `docker push` defaults to
# docker.io, which fails outright (no docker.io credentials/repo access, and "library/*" is a
# reserved namespace nobody can push to). Confirmed the hard way after an apps/servers/* build
# failed with "push access denied ... docker.io/library/<name>".
k3d cluster create "$NAME" \
  -p "8080:30080@server:0" \
  -p "8443:30443@server:0" \
  --k3s-arg "--disable=traefik@server:0" \
  --registry-create "$NAME-registry:0.0.0.0:5000"

# fs.inotify.max_user_instances is a global (non-namespaced) kernel limit shared by every pod's
# file watcher — the WSL2/Docker Desktop default of 128 is enough for a couple of dev servers but
# gets exhausted with this repo's full stack (6+ rsbuild/bun watchers, plus any crashlooping pod
# retrying its own). Once exhausted, whichever pod tries next fails with entr's generic
# "cannot create kqueue: No file descriptors available" — nothing to do with actual fds or that
# pod's own history. Not persisted across a WSL restart (it's a live sysctl write); rerun this
# script or `docker exec k3d-$NAME-server-0 sh -c "echo 1024 > /proc/sys/fs/inotify/max_user_instances"`
# again if it recurs.
docker exec "k3d-$NAME-server-0" sh -c "echo 1024 > /proc/sys/fs/inotify/max_user_instances"

# Pre-installs services/traefik's own chart CRDs (TLSStore among them — see that chart's
# values.yaml tlsStore: block) before services/terraform ever runs. Doing this in Terraform
# itself doesn't work: provider "helm"'s `experiments.manifest = true` (versions.tf) dry-run
# renders every helm_release's manifest at *plan* time to diff it, and on a from-scratch cluster
# that render fails outright ("no matches for kind \"TLSStore\": ensure CRDs are installed
# first") before any provisioner that might install the CRDs ever gets to run — provisioners
# only execute during apply, never during plan, and Terraform always computes a plan first, so
# even a plain `terraform apply` hits the exact same failure. Doing it once here, at cluster
# creation (a cluster-lifetime concern, same as `terraform apply` itself only needing to run
# once per cluster — see root CLAUDE.md), sidesteps the chicken-and-egg entirely: by the time
# anyone runs `terraform plan`/`apply`, the CRDs already exist.
SERVICES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../services" && pwd)"

helm dependency update "$SERVICES_DIR/traefik/helm" >/dev/null
helm show crds "$SERVICES_DIR/traefik/helm" | kubectl --context "k3d-$NAME" apply -f -

# cert-manager-config's own Certificate/Issuer CRs (services/cert-manager-config/helm) hit the
# exact same chicken-and-egg against cert-manager's CRDs — see the comment above. Unlike
# traefik's dependency, jetstack's cert-manager chart doesn't ship its CRDs under the special
# crds/ directory `helm show crds` reads — they're a regular template
# (charts/cert-manager/templates/crds.yaml, gated by services/cert-manager/helm/values.yaml's
# crds.enabled) — so `helm show crds` silently returns nothing for it; `helm template
# --show-only` renders that one template directly instead.
helm dependency update "$SERVICES_DIR/cert-manager/helm" >/dev/null
helm template "$SERVICES_DIR/cert-manager/helm" --show-only charts/cert-manager/templates/crds.yaml \
  | kubectl --context "k3d-$NAME" apply -f -

# services/cert-manager/helm/values.yaml's own crds.enabled: true means the "cert-manager"
# helm_release (services/terraform/main.tf) also wants to own/manage these same CRDs — without
# pre-adopting them here (the annotations/label Helm 3 requires to import a pre-existing
# resource into a release it didn't create), that release fails on its first apply with
# "exists and cannot be imported into the current release: invalid ownership metadata".
# release-name/namespace below must match that helm_release block's own name/namespace exactly.
for crd in certificaterequests certificates challenges.acme clusterissuers issuers orders.acme; do
  kubectl --context "k3d-$NAME" annotate "crd/${crd}.cert-manager.io" \
    meta.helm.sh/release-name=cert-manager meta.helm.sh/release-namespace=infra --overwrite
  kubectl --context "k3d-$NAME" label "crd/${crd}.cert-manager.io" \
    app.kubernetes.io/managed-by=Helm --overwrite
done
