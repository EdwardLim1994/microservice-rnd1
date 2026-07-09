variable "namespace" {
  description = "Kubernetes namespace vault is deployed into (shared with kafka/redis/apollo-router/meilisearch — must already exist)"
  type        = string
}

variable "dev_root_token_id" {
  description = "Vault dev-mode root token (matches services/vault/docker-compose.yml's VAULT_DEV_ROOT_TOKEN_ID default)"
  type        = string
  sensitive   = true
}
