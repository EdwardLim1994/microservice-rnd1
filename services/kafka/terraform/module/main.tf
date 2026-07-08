# No kubernetes_namespace resource here, unlike servers/demo1/terraform/module — kafka shares the
# "infra" namespace with services/redis and services/apollo (deployed/torn down as one unit, not
# per-app), so the namespace is created exactly once, by services/terraform (the aggregating
# root) — see services/terraform/CLAUDE.md. This module assumes var.namespace already exists.

resource "helm_release" "kafka" {
  name      = "kafka"
  # path.module resolves relative to this file's own location on disk, not the caller's — see
  # servers/demo1/terraform/module/main.tf for the full explanation of abspath()'s purpose here.
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace

  set {
    name  = "namespace"
    value = var.namespace
  }
}
