# Unlike terraform/main.tf (the app-aggregating root), this state is entirely separate and never
# touched by app-level applies/destroys — see services/terraform/CLAUDE.md for why that isolation
# matters for "always-on, never torn down" infra. Each module block below depends on
# kubernetes_namespace.infra existing first (implicit via the namespace value; Terraform still
# orders correctly off the resource reference).

module "kafka" {
  source = "../kafka/terraform/module"

  namespace = kubernetes_namespace.infra.metadata[0].name
}

module "redis" {
  source = "../redis/terraform/module"

  namespace = kubernetes_namespace.infra.metadata[0].name
  password  = var.redis_password
}

module "apollo_router" {
  source = "../apollo/terraform/module"

  namespace = kubernetes_namespace.infra.metadata[0].name
}

module "meilisearch" {
  source = "../meilisearch/terraform/module"

  namespace  = kubernetes_namespace.infra.metadata[0].name
  master_key = var.meilisearch_master_key
}

module "minio" {
  source = "../minio/terraform/module"

  namespace     = kubernetes_namespace.infra.metadata[0].name
  root_user     = var.minio_root_user
  root_password = var.minio_root_password
}

module "vault" {
  source = "../vault/terraform/module"

  namespace         = kubernetes_namespace.infra.metadata[0].name
  dev_root_token_id = var.vault_dev_root_token_id
}

module "monitoring" {
  source = "../monitoring/terraform/module"

  namespace              = kubernetes_namespace.infra.metadata[0].name
  grafana_admin_user     = var.grafana_admin_user
  grafana_admin_password = var.grafana_admin_password
}

module "debezium" {
  source = "../debezium/terraform/module"

  namespace = kubernetes_namespace.infra.metadata[0].name
}

module "authentik" {
  source = "../authentik/terraform/module"

  namespace           = kubernetes_namespace.infra.metadata[0].name
  secret_key          = var.authentik_secret_key
  postgresql_password = var.authentik_postgresql_password
  bootstrap_password  = var.authentik_bootstrap_password
  bootstrap_token     = var.authentik_bootstrap_token
}

# Deployed last of this file's modules only by convention (no ordering dependency on the others —
# Terraform still applies purely off the kubernetes_namespace.infra reference every module shares).
# Fronts apollo_router/monitoring's grafana/authentik's Ingress objects (all three in this same
# "infra" namespace) plus whatever Ingress objects exist in the app-aggregating root terraform/'s
# own namespaces (mfe1, web1) — see services/traefik/CLAUDE.md's Kubernetes section for the full
# routed set and why a ClusterRole (not a namespaced Role) is required for that cross-namespace
# reach.
module "traefik" {
  source = "../traefik/terraform/module"

  namespace = kubernetes_namespace.infra.metadata[0].name
}
