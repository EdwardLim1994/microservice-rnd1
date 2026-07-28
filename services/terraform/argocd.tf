# Prod-only cluster tooling — services/argocd/helm wraps the upstream argo-helm chart
# as a dependency (same pattern as authentik/traefik) but has no Tiltfile, since it's
# never rendered locally. Own namespace, not part of the services for_each in main.tf
# since that for_each also expects Tilt to render each chart locally.
resource "kubernetes_namespace" "argocd" {
  metadata {
    name = "argocd"
  }
}

# argo-cd's own values.yaml can't call Helm's `lookup` (values files aren't templated), unlike
# services/minio|monitoring|vault's own hand-rolled charts, which set their authentik.lan
# hostAliases IP straight in a template via `lookup`. This data source is the terraform-level
# equivalent, feeding the same ClusterIP into the third-party subchart's `global.hostAliases` via
# a `set` block below. depends_on forces this to read only after traefik's chart (and its
# services/traefik/helm/templates/web-8080-service.yaml) actually exists — a bare data source
# would otherwise hard-fail (unlike `lookup`, which degrades gracefully) on a from-scratch apply
# if it happened to evaluate first.
data "kubernetes_service" "traefik_web_8080" {
  metadata {
    name      = "traefik-web-8080"
    namespace = "infra"
  }

  depends_on = [helm_release.service]
}

resource "helm_release" "argocd" {
  name      = "argocd"
  chart     = "${path.module}/../argocd/helm"
  namespace = kubernetes_namespace.argocd.metadata[0].name
  # wait=false (see main.tf's comment) only skips waiting for pod readiness — Helm always blocks
  # on pre-install/pre-upgrade hook Jobs regardless (this chart's redis-secret-init Job), and the
  # default 300s timeout isn't enough on a cold node pulling images for the first time.
  wait    = false
  timeout = 900

  # argocd-server validates Authentik's OIDC discovery document server-side (same reasoning as
  # the other three apps' hostAliases) — needs "authentik.lan" to resolve to Traefik's
  # dynamically-assigned ClusterIP, not the in-cluster Service DNS name.
  set {
    name  = "argo-cd.global.hostAliases[0].ip"
    value = data.kubernetes_service.traefik_web_8080.spec[0].cluster_ip
  }
  set {
    name  = "argo-cd.global.hostAliases[0].hostnames[0]"
    value = "authentik.lan"
  }
}
