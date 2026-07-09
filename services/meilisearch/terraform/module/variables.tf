variable "namespace" {
  description = "Kubernetes namespace meilisearch is deployed into (shared with kafka/redis/apollo — must already exist)"
  type        = string
}

variable "master_key" {
  description = "Meilisearch master key (matches services/meilisearch/docker-compose.yml's MEILISEARCH_MASTER_KEY default)"
  type        = string
  sensitive   = true
}
