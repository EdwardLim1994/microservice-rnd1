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

# Deploys each services/<name>/helm chart as-is — one copy of each service's manifests to
# maintain, applied here and nowhere else.
locals {
  # vault and ca-distribution are NOT here — see their own dedicated helm_release blocks below.
  services = toset([
    "apicurio-registry",
    "authentik",
    "kafka",
    "meilisearch",
    "minio",
    "monitoring",
    "unleash",
  ])

  # Every one of these is duplicated by hand across two independent Helm releases today (see
  # each app's own values.yaml — "must match services/authentik/helm/values.yaml's
  # <app>OidcClientSecret"). Only meaningful on a non-dev cluster (see the set_sensitive blocks
  # below) — dev keeps the hand-typed matched placeholders already in each chart's values.yaml,
  # unchanged.
  oidc_secret_overrides = {
    authentik = {
      "minioOidcClientSecret"                      = random_password.minio_oidc_client_secret.result
      "grafanaOidcClientSecret"                    = random_password.grafana_oidc_client_secret.result
      "vaultOidcClientSecret"                      = random_password.vault_oidc_client_secret.result
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
# Only actually used, via oidc_secret_overrides above, when environment != "dev".
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

resource "helm_release" "service" {
  for_each = local.services

  name      = each.key
  chart     = "${path.module}/../${each.key}/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  # Don't block apply on pod readiness — on a cold node that's routinely 10-15min, and every
  # cancelled/killed wait leaves the release's Helm secret stuck in pending-install, which then
  # blocks all future installs/upgrades until manually cleared. Check `kubectl get pods` instead.
  wait    = false
  timeout = 300

  # Chart's own values.yaml (dev-mode defaults, safe to commit) always applies first. On any
  # non-dev apply (sit/uat/staging/prod), each chart's values-nondev.yaml — where one exists —
  # layers on top as a Helm values file, same mechanism as `helm upgrade -f values.yaml -f
  # values-nondev.yaml`. Nothing today differs between the four real clusters, so they share one
  # file rather than one each. Charts with nothing non-dev differs on (kafka, meilisearch, ...)
  # simply have no values-nondev.yaml and this is a no-op for them.
  #
  # values-tailscale.yaml (authentik, monitoring only) layers on top unconditionally in dev —
  # no LAN/tailscale toggle. Points Grafana's OAuth
  # authUrl/rootUrl at the tailscale tunnel scripts/port-forward.sh opens instead of
  # "authentik.lan"/"grafana.lan", which only resolve on-LAN — off-LAN clients (e.g. a phone or
  # tablet on the tailnet but not the LAN) hit an unreachable host without this.
  values = concat(
    var.environment == "dev" && fileexists("${path.module}/../${each.key}/helm/values-tailscale.yaml")
    ? [file("${path.module}/../${each.key}/helm/values-tailscale.yaml")]
    : [],
    var.environment != "dev" && fileexists("${path.module}/../${each.key}/helm/values-nondev.yaml")
    ? [file("${path.module}/../${each.key}/helm/values-nondev.yaml")]
    : []
  )

  # Real secrets, never committed — only meaningful (and only required) for a non-dev cluster.
  dynamic "set_sensitive" {
    for_each = var.environment != "dev" ? lookup(local.oidc_secret_overrides, each.key, {}) : {}
    content {
      name  = set_sensitive.key
      value = set_sensitive.value
    }
  }

  depends_on = [helm_release.traefik]
}

# Not in the for_each above, unlike before — pulled out so it can depends_on
# helm_release.service["authentik"] specifically. vault's own db-provision-job.yaml/
# oidc-provision-job.yaml post-install hooks (which a real `helm_release` always blocks on,
# wait=false or not — see the for_each block's own comment) roll/poll authentik-server +
# authentik-worker, which have to exist first. Being co-members of the same for_each (as
# before) gave Terraform no ordering between them at all, just parallel apply — vault's hooks
# could then run before authentik's release had even started, hanging on oidc-provision's own
# 15min discovery-endpoint poll or failing outright via db-provision's `kubectl rollout status`
# (no retry loop of its own — see that Job's own header comment).
resource "helm_release" "vault" {
  name      = "vault"
  chart     = "${path.module}/../vault/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  wait      = false
  # Default 300s isn't enough for oidc-provision-job.yaml on a from-scratch cluster — see above.
  timeout = 900

  # values-tailscale.yaml layering same as the for_each "service" block's own comment — needed
  # here too since vault's own oidc/role/default allowed_redirect_uris (values.yaml's
  # oidcRedirectUris) needs the tailnet host added for off-LAN devices.
  values = concat(
    var.environment == "dev" && fileexists("${path.module}/../vault/helm/values-tailscale.yaml")
    ? [file("${path.module}/../vault/helm/values-tailscale.yaml")]
    : [],
    var.environment != "dev" && fileexists("${path.module}/../vault/helm/values-nondev.yaml")
    ? [file("${path.module}/../vault/helm/values-nondev.yaml")]
    : []
  )

  # k8s-auth-provision-job.yaml's dev-mode branch bootstraps with the literal `.Values.rootToken`
  # (not a live read of the Secret) — matches vault-secret's own value only if rootToken is
  # something other than its "vaultroottoken" default, which is what makes secret.yaml skip
  # randomizing it (see that file's own comment). Only matters in dev — values-nondev.yaml
  # sets devMode: false on every real cluster, and that job's non-dev branch never reads
  # rootToken at all. Ignored (and harmless) there for the same reason.
  set {
    name  = "rootToken"
    value = "terraform-local-dev-vault-token"
  }

  dynamic "set_sensitive" {
    for_each = var.environment != "dev" ? local.oidc_secret_overrides.vault : {}
    content {
      name  = set_sensitive.key
      value = set_sensitive.value
    }
  }

  depends_on = [helm_release.traefik, helm_release.service["authentik"]]
}

# Not in the for_each above, same reason as vault: pulled out so it can depends_on
# helm_release.vault specifically. fetch-ca's own initContainer
# (services/ca-distribution/helm/templates/deployment.yaml) reads `vault read pki/cert/ca`,
# which 400s ("no default issuer currently configured") until vault's own pki-provision-job.yaml
# hook has run — which only happens once helm_release.vault above has actually applied.
resource "helm_release" "ca-distribution" {
  name      = "ca-distribution"
  chart     = "${path.module}/../ca-distribution/helm"
  namespace = kubernetes_namespace.infra.metadata[0].name
  wait      = false

  depends_on = [helm_release.vault]
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

  # Non-dev Issuer authenticates to vault via Kubernetes auth instead of the dev root token —
  # see cert-manager-config/helm/templates/issuer.yaml.
  values = (
    var.environment != "dev" && fileexists("${path.module}/../cert-manager-config/helm/values-nondev.yaml")
    ? [file("${path.module}/../cert-manager-config/helm/values-nondev.yaml")]
    : []
  )

  # helm_release.vault explicitly, not just implied via helm_release.service — vault is no
  # longer a member of that for_each (see its own dedicated helm_release block above), so this
  # chart's own Issuer needing the pki_int role from vault's pki-provision-job.yaml hook (see
  # this resource's header comment) would otherwise have no ordering against vault at all.
  depends_on = [helm_release.cert-manager, helm_release.service, helm_release.vault]
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
