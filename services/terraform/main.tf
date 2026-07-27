resource "kubernetes_namespace" "infra" {
  metadata {
    name = var.namespace
  }
}

# Deploys each services/<name>/helm chart as-is — same chart Tilt renders locally,
# so there's exactly one copy of each service's manifests to maintain.
locals {
  services = toset([
    "apicurio-registry",
    "authentik",
    "debezium",
    "kafka",
    "meilisearch",
    "minio",
    "monitoring",
    "traefik",
    "vault",
  ])
}

resource "helm_release" "service" {
  for_each = local.services

  name      = each.key
  chart     = "${path.module}/../${each.key}/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  # Don't block apply on pod readiness — on a cold node that's routinely 10-15min, and every
  # cancelled/killed wait leaves the release's Helm secret stuck in pending-install, which then
  # blocks all future installs/upgrades until manually cleared. Check `kubectl get pods` instead.
  wait = false
}

# Not in the for_each above — services/apollo/helm/files/supergraph.graphql is still the
# checked-in placeholder (no subgraphs registered in rover.yaml yet), so the router can never
# actually start; a short timeout keeps that from stalling every apply for the full 900s.
resource "helm_release" "apollo" {
  name      = "apollo"
  chart     = "${path.module}/../apollo/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  wait      = false
}

# Cluster tooling, not an app dependency — own namespace, pinned upstream chart.
resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
  }
}

resource "helm_release" "argocd" {
  name       = "argocd"
  repository = "https://argoproj.github.io/argo-helm"
  chart      = "argo-cd"
  version    = "10.2.1"
  namespace  = kubernetes_namespace.argocd.metadata[0].name
  wait       = false
}
