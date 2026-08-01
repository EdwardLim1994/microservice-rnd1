# Every apps/servers/<name>-infra chart (Postgres/Redis/etc. for that server — see
# ServerExtensionGenerator) is deployed here, by Terraform, same as services/*. Its app
# counterpart (apps/servers/<name>, the "<name>-app" namespace) stays Tilt-iterated on every
# `tilt up` — see both charts' own values.yaml "Own namespace, separate from..." comments.
locals {
  infra_charts = toset([
    for f in fileset("${path.module}/../servers", "*-infra/helm/Chart.yaml") : split("/", f)[0]
  ])
}

# Both namespaces per chart are created here, by neither chart itself — <name>-infra's own
# db-provision-job.yaml/redis-provision-job.yaml need a Role/RoleBinding to already exist in
# <name>-app (see those templates' own header comments for the full cross-namespace RBAC shape),
# and creating both upfront means that works regardless of whether this `terraform apply` or the
# app chart's own `tilt up` runs first — a RoleBinding just needs its target *namespace* to
# exist, not the ServiceAccount/Secret/Deployment it actually authorizes yet.
resource "kubernetes_namespace" "infra" {
  for_each = local.infra_charts
  metadata {
    name = each.key
  }
}

resource "kubernetes_namespace" "app" {
  for_each = local.infra_charts
  metadata {
    name = replace(each.key, "-infra", "-app")
  }
}

# db.yaml/redis.yaml's own randAlphaNum-generated passwords are fine under a plain `helm
# install`/`upgrade` (only ever rendered once, at apply time) but not under this provider's
# experiments.manifest=true (see versions.tf) — that renders the chart a *second* time, at plan
# time, to compute the manifest Terraform diffs against; two independent randAlphaNum renders
# never match, so the provider sees "inconsistent final plan" and errors out. Pinning these to a
# fixed value here (same fix services/terraform/main.tf's own helm_release.vault uses for
# rootToken) makes both renders identical. Terraform-managed `random_password`, not a literal —
# stored in state, not committed, unlike the Tilt-only literal overrides these charts' own
# values.yaml comments describe.
resource "random_password" "db" {
  for_each = local.infra_charts
  length   = 32
  special  = false
}
resource "random_password" "redis" {
  for_each = local.infra_charts
  length   = 32
  special  = false
}

# Requires services/terraform to have already been applied — each <name>-infra chart's
# db-provision-job.yaml/redis-provision-job.yaml authenticate against services/vault
# (http://vault.infra.svc.cluster.local:8200) via the "db-provision" Kubernetes-auth role
# services/vault/helm/templates/k8s-auth-provision-job.yaml sets up (bound_service_account_names
# already includes "vault-db-provision"/"vault-redis-provision", bound_service_account_namespaces
# = "*", so it doesn't care which namespace this Job's ServiceAccount actually lives in). No
# explicit `depends_on` across these two independent terraform roots is possible — if this fails
# with "connection refused" against vault.infra.svc.cluster.local, run services/terraform first.
resource "helm_release" "infra" {
  for_each = local.infra_charts

  name      = each.key
  chart     = "${path.module}/../servers/${each.key}/helm"
  namespace = kubernetes_namespace.infra[each.key].metadata[0].name
  # Don't block apply on pod readiness — same reasoning as services/terraform's own helm_release
  # blocks: a cancelled/killed wait leaves the release's Helm secret stuck in pending-install,
  # which then blocks all future installs/upgrades until manually cleared.
  wait    = false
  timeout = 900

  set_sensitive {
    name  = "dbPassword"
    value = random_password.db[each.key].result
  }
  set_sensitive {
    name  = "redisPassword"
    value = random_password.redis[each.key].result
  }

  depends_on = [kubernetes_namespace.app]
}
