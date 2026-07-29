resource "kubernetes_namespace" "infra" {
  metadata {
    name = var.namespace
  }
}

# traefik installs separately (not in the for_each below) so the rest of the services can
# depend_on it — minio/monitoring's charts look up services/traefik/helm/templates/
# web-8080-service.yaml's ClusterIP via Helm's `lookup` at template-render time (to bake
# "authentik.lan" into their pod hostAliases, see their statefulset.yaml comments), and `lookup`
# has no retry: if traefik doesn't exist yet at that exact moment, it silently falls back to
# 127.0.0.1 and stays wrong for the pod's whole lifetime — no error, just a login that fails with
# "failed to retrieve token" (grafana) or never offers SSO at all (minio). Without this
# depends_on, the for_each's own parallelism raced this on every from-scratch apply.
resource "helm_release" "traefik" {
  name      = "traefik"
  chart     = "${path.module}/../traefik/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  wait      = false
}

# Deploys each services/<name>/helm chart as-is — same chart Tilt renders locally,
# so there's exactly one copy of each service's manifests to maintain.
locals {
  services = toset([
    "apicurio-registry",
    "authentik",
    "ca-distribution",
    "kafka",
    "meilisearch",
    "minio",
    "monitoring",
    "vault",
  ])

  # wait=false (below) only skips waiting on pod readiness — Helm still always blocks on
  # pre/post-install hook Jobs regardless, and the default 300s timeout isn't enough for
  # vault's oidc-provision-job.yaml on a from-scratch cluster: it polls authentik's discovery
  # endpoint until the blueprint's "vault" application exists, and on a cold node
  # authentik-postgresql alone can still be PodInitializing minutes in (see the "cold node
  # 10-15min" reasoning below). Same class of fix as argocd.tf's own timeout override.
  service_timeouts = {
    vault = 900
  }
}

resource "helm_release" "service" {
  for_each = local.services

  name      = each.key
  chart     = "${path.module}/../${each.key}/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  # Don't block apply on pod readiness — on a cold node that's routinely 10-15min, and every
  # cancelled/killed wait leaves the release's Helm secret stuck in pending-install, which then
  # blocks all future installs/upgrades until manually cleared. Check `kubectl get pods` instead.
  wait    = false
  timeout = try(local.service_timeouts[each.key], 300)

  depends_on = [helm_release.traefik]
}

# Not in the for_each above. cert-manager itself, and its Issuer/Certificate config, are two
# separate helm_releases (not one) deliberately: applying a CRD and a custom resource of that
# CRD's kind in the *same* release races the API server (it hasn't finished registering the new
# kind yet), which is exactly the "no matches for kind Certificate/Issuer" error this used to hit
# as one release. Two terraform-sequenced releases guarantee a real apply boundary in between.
resource "helm_release" "cert-manager" {
  name      = "cert-manager"
  chart     = "${path.module}/../cert-manager/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  wait      = true
  timeout   = 600

  depends_on = [helm_release.service]
}

# services/vault's pki-provision-job.yaml sets up the pki_int role this chart's Issuer signs
# against — needs vault's release to have already run its hooks, not just exist. wait=true above
# (not the repo's usual wait=false) is what actually closes the CRD race for this one: it forces
# terraform to block until cert-manager's CRDs+webhook are ready before this release ever
# applies.
resource "helm_release" "cert-manager-config" {
  name      = "cert-manager-config"
  chart     = "${path.module}/../cert-manager-config/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  wait      = false
  timeout   = 300

  depends_on = [helm_release.cert-manager, helm_release.service]
}

# Not in the for_each above — services/apollo/helm/values.supergraph.yaml is still the
# checked-in placeholder (no subgraphs registered in rover.yaml yet), so the router can never
# actually start; wait=false keeps that from stalling every apply.
resource "helm_release" "apollo" {
  name      = "apollo"
  chart     = "${path.module}/../apollo/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  wait      = false

  values = [
    file("${path.module}/../apollo/helm/values.supergraph.yaml"),
  ]
}
