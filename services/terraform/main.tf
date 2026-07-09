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
