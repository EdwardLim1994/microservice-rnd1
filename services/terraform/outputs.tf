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
