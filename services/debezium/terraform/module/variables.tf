variable "namespace" {
  description = "Kubernetes namespace kafka-connect is deployed into (shared with kafka/redis/apollo/vault/meilisearch — must already exist)"
  type        = string
}
