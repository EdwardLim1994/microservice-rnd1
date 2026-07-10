output "namespace" {
  value = kubernetes_namespace.infra.metadata[0].name
}

output "kafka_release_status" {
  value = module.kafka.release_status
}

output "redis_release_status" {
  value = module.redis.release_status
}

output "apollo_router_release_status" {
  value = module.apollo_router.release_status
}

output "meilisearch_release_status" {
  value = module.meilisearch.release_status
}

output "vault_release_status" {
  value = module.vault.release_status
}

output "monitoring_release_status" {
  value = module.monitoring.release_status
}

output "authentik_release_status" {
  value = module.authentik.release_status
}

output "traefik_release_status" {
  value = module.traefik.release_status
}
