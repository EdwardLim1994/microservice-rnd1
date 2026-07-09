variable "namespace" {
  description = "Kubernetes namespace monitoring is deployed into (shared with kafka/redis/apollo/meilisearch/vault — must already exist)"
  type        = string
}

variable "grafana_admin_user" {
  description = "Grafana admin username (matches services/monitoring/docker-compose.yml's GRAFANA_ADMIN_USER default)"
  type        = string
}

variable "grafana_admin_password" {
  description = "Grafana admin password (matches services/monitoring/docker-compose.yml's GRAFANA_ADMIN_PASSWORD default)"
  type        = string
  sensitive   = true
}
