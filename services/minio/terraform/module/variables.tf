variable "namespace" {
  description = "Kubernetes namespace minio is deployed into (shared with kafka/redis/apollo/meilisearch — must already exist)"
  type        = string
}

variable "root_user" {
  description = "MinIO root user (matches services/minio/docker-compose.yml's MINIO_ROOT_USER default)"
  type        = string
}

variable "root_password" {
  description = "MinIO root password (matches services/minio/docker-compose.yml's MINIO_ROOT_PASSWORD default)"
  type        = string
  sensitive   = true
}
