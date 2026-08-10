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
# giving each server its own namespace anymore. The one exception is the Vault-provisioning
# ServiceAccount/Role/RoleBinding trio, which is also per-server-prefixed now (see
# services/vault/helm/templates/k8s-auth-provision-job.yaml's bound_service_account_names="*").
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
# fixed value here (same fix services/terraform/main.tf's own helm_release.vault uses for
# rootToken) makes both renders identical. Terraform-managed `random_password`, not a literal —
# stored in state, not committed (see db.yaml.hbs's own comment on this override).
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
# = "*" now — every server's own <name>-vault-db-provision/<name>-vault-redis-provision
# ServiceAccount authenticates as this same role, since bound_service_account_namespaces is
# already "*" too and per-server-prefixed SA names are what avoid the k8s-level naming collision
# these two now-shared namespaces would otherwise cause). No explicit `depends_on` across these
# two independent terraform roots is possible — if this fails with "connection refused" against
# vault.infra.svc.cluster.local, run services/terraform first.
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
