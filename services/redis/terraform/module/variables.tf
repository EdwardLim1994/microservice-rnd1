variable "namespace" {
  description = "Kubernetes namespace redis is deployed into (shared with kafka/apollo — must already exist)"
  type        = string
}

variable "password" {
  description = "Redis auth password (matches services/redis/docker-compose.yml's REDIS_PASSWORD default)"
  type        = string
  sensitive   = true
}
