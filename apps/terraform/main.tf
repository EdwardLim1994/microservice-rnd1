# Every apps/servers/<name>-infra chart (Postgres/Redis/etc. for that server — see
# ServerExtensionGenerator) is deployed here, by Terraform, same as services/*. Its app
# counterpart (apps/servers/<name>) is deployed separately (currently no automated orchestrator
# for it — build/deploy manually: `docker build` + `helm install`) — see both charts' own
# values.yaml "Own namespace, separate from..." comments.
locals {
  infra_charts = toset([
    for f in fileset("${path.module}/../servers", "*-infra/helm/Chart.yaml") : split("/", f)[0]
  ])
}

# Two fixed, shared namespaces — every server's infra chart (Postgres/Redis/etc.) lands in
# "server-infra", every server's app chart (grpc/graphql) lands in "server-apps", regardless of
# which server they belong to. Not one pair per chart like before: that's the whole point of this
# convention (see each chart's own values.yaml "namespace"/"appNamespace"/"infraNamespace"
# comments) — a resource collision between two servers' infra charts is avoided by prefixing every
# object name with that server's own name (server1-grpc-db, server2-grpc-db-secret, etc.), not by
# giving each server its own namespace anymore.
resource "kubernetes_namespace" "server_infra" {
  metadata {
    name = "server-infra"
  }
}

resource "kubernetes_namespace" "server_apps" {
  metadata {
    name = "server-apps"
  }
}

# db.yaml/redis.yaml's own randAlphaNum-generated passwords are fine under a plain `helm
# install`/`upgrade` (only ever rendered once, at apply time) but not under this provider's
# experiments.manifest=true (see versions.tf) — that renders the chart a *second* time, at plan
# time, to compute the manifest Terraform diffs against; two independent randAlphaNum renders
# never match, so the provider sees "inconsistent final plan" and errors out. Pinning these to a
# fixed value here makes both renders identical. Terraform-managed `random_password`, not a
# literal — stored in state, not committed (see db.yaml.hbs's own comment on this override).
# This is also the DB/Redis credential in full — static for the life of the deploy, same as
# services/terraform's own authentik_postgres_password, no dynamic-credential provisioner.
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

# No dependency on services/terraform having been applied first — every <name>-infra chart's
# Postgres credential is static (this file's own random_password.db above), read same-namespace
# by the Postgres container itself and cross-namespace `lookup`'d by the app chart's own env.yaml
# (see db.yaml.hbs) — no external provisioner to authenticate against.
resource "helm_release" "infra" {
  for_each = local.infra_charts

  name      = each.key
  chart     = "${path.module}/../servers/${each.key}/helm"
  namespace = kubernetes_namespace.server_infra.metadata[0].name
  # Wait for the post-install db-provision Job to actually finish (and succeed) before apply
  # returns — previously wait=false let apply "succeed" even when that hook Job failed
  # (BackoffLimitExceeded), leaving the release stuck in a half-provisioned state that only
  # surfaced later as a downstream app auth failure. Trade-off: a cancelled/killed apply can still
  # leave the release's Helm secret in pending-install, requiring a manual `helm rollback`/delete
  # to unstick future installs — accepted so failures surface here instead of silently downstream.
  wait          = true
  wait_for_jobs = true
  timeout       = 900

  set_sensitive {
    name  = "dbPassword"
    value = random_password.db[each.key].result
  }
  set_sensitive {
    name  = "redisPassword"
    value = random_password.redis[each.key].result
  }

  depends_on = [kubernetes_namespace.server_apps]
}
