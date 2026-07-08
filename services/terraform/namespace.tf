# Created exactly once, here — kafka/redis/apollo-router's own terraform modules deliberately do
# NOT create this namespace themselves (unlike an app's per-app namespace), because it's shared
# across all three. See services/terraform/CLAUDE.md for the full reasoning.
resource "kubernetes_namespace" "infra" {
  metadata {
    name = var.namespace
  }
}
