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

  # Every one of these is duplicated by hand across two independent Helm releases today (see
  # each app's own values.yaml — "must match services/authentik/helm/values.yaml's
  # <app>OidcClientSecret"). Only meaningful in prod (see the set_sensitive blocks below and
  # argocd.tf's) — dev keeps the hand-typed matched placeholders already in each chart's
  # values.yaml, unchanged.
  oidc_secret_overrides = {
    authentik = {
      "minioOidcClientSecret"                      = random_password.minio_oidc_client_secret.result
      "grafanaOidcClientSecret"                    = random_password.grafana_oidc_client_secret.result
      "vaultOidcClientSecret"                      = random_password.vault_oidc_client_secret.result
      "argocdOidcClientSecret"                     = random_password.argocd_oidc_client_secret.result
      "authentik.authentik.secret_key"             = var.authentik_secret_key
      "authentik.authentik.postgresql.password"    = var.authentik_postgres_password
      "authentik.postgresql.auth.password"         = var.authentik_postgres_password
      "authentik.postgresql.auth.postgresPassword" = var.authentik_postgres_password
      "authentik.global.env[0].value"              = var.authentik_bootstrap_password
    }
    minio = {
      "oidcClientSecret" = random_password.minio_oidc_client_secret.result
    }
    monitoring = {
      "grafana.oidcClientSecret" = random_password.grafana_oidc_client_secret.result
    }
    vault = {
      "oidcClientSecret" = random_password.vault_oidc_client_secret.result
    }
  }
}

# Cheap, side-effect-free — always created regardless of environment (referencing them from a
# count/for_each = 0 resource in a dev apply would itself be a plan-time error, not just a no-op).
# Only actually used, via oidc_secret_overrides above, when environment = "prod".
resource "random_password" "minio_oidc_client_secret" {
  length  = 32
  special = false
}
resource "random_password" "grafana_oidc_client_secret" {
  length  = 32
  special = false
}
resource "random_password" "vault_oidc_client_secret" {
  length  = 32
  special = false
}
resource "random_password" "argocd_oidc_client_secret" {
  length  = 32
  special = false
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

  # Chart's own values.yaml (dev-mode defaults, safe to commit) always applies first. On a prod
  # apply, each chart's values-prod.yaml — where one exists — layers on top as a Helm values file,
  # same mechanism as `helm upgrade -f values.yaml -f values-prod.yaml`. Charts with nothing prod
  # differs on (kafka, meilisearch, ...) simply have no values-prod.yaml and this is a no-op for
  # them.
  values = (
    var.environment == "prod" && fileexists("${path.module}/../${each.key}/helm/values-prod.yaml")
    ? [file("${path.module}/../${each.key}/helm/values-prod.yaml")]
    : []
  )

  # Real secrets, never committed — only meaningful (and only required) for prod.
  dynamic "set_sensitive" {
    for_each = var.environment == "prod" ? lookup(local.oidc_secret_overrides, each.key, {}) : {}
    content {
      name  = set_sensitive.key
      value = set_sensitive.value
    }
  }

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

  # Prod-mode Issuer authenticates to vault via Kubernetes auth instead of the dev root token —
  # see cert-manager-config/helm/templates/issuer.yaml.
  values = (
    var.environment == "prod" && fileexists("${path.module}/../cert-manager-config/helm/values-prod.yaml")
    ? [file("${path.module}/../cert-manager-config/helm/values-prod.yaml")]
    : []
  )

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
