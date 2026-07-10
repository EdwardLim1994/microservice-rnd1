variable "namespace" {
  description = "Kubernetes namespace authentik is deployed into (shared with kafka/redis/apollo/meilisearch/vault/debezium — must already exist)"
  type        = string
}

variable "secret_key" {
  description = "authentik secret key, used to sign cookies/tokens (matches services/authentik/docker-compose.yml's AUTHENTIK_SECRET_KEY default)"
  type        = string
  sensitive   = true
}

variable "postgresql_password" {
  description = "authentik's dedicated Postgres password"
  type        = string
  sensitive   = true
}

variable "bootstrap_password" {
  description = "Initial akadmin superuser password (only takes effect on first boot — see services/authentik/CLAUDE.md)"
  type        = string
  sensitive   = true
}
