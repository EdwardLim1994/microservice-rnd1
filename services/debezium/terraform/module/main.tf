# No kubernetes_namespace resource here, unlike servers/test1/terraform/module — kafka-connect
# shares the "infra" namespace with services/kafka/services/redis/services/apollo/services/vault/
# services/meilisearch (deployed/torn down as one unit, not per-app), created exactly once by
# services/terraform (the aggregating root) — see services/terraform/CLAUDE.md. This module
# assumes var.namespace already exists.

resource "helm_release" "debezium" {
  name = "debezium"
  # path.module resolves relative to this file's own location on disk, not the caller's — see
  # servers/test1/terraform/module/main.tf for the full explanation of abspath()'s purpose here.
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace

  set {
    name  = "namespace"
    value = var.namespace
  }
}
