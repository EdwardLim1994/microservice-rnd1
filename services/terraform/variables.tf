variable "kubeconfig_path" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "kubeconfig context to deploy into"
  type        = string
  default     = "minikube"
}

variable "namespace" {
  description = "Shared Kubernetes namespace for kafka/redis/apollo-router — created once, here"
  type        = string
  default     = "infra"
}

variable "redis_password" {
  description = "Redis auth password"
  type        = string
  default     = "redispassword"
  sensitive   = true
}

variable "meilisearch_master_key" {
  description = "Meilisearch master key"
  type        = string
  default     = "meilimasterkey"
  sensitive   = true
}

variable "vault_dev_root_token_id" {
  description = "Vault dev-mode root token"
  type        = string
  default     = "root"
  sensitive   = true
}

variable "grafana_admin_user" {
  description = "Grafana admin username"
  type        = string
  default     = "admin"
}

variable "grafana_admin_password" {
  description = "Grafana admin password"
  type        = string
  default     = "admin"
  sensitive   = true
}

variable "authentik_secret_key" {
  description = "authentik secret key, used to sign cookies/tokens"
  type        = string
  default     = "changeme-generate-a-real-secret-key"
  sensitive   = true
}

variable "authentik_postgresql_password" {
  description = "authentik's dedicated Postgres password"
  type        = string
  default     = "authentikpassword"
  sensitive   = true
}

variable "authentik_bootstrap_password" {
  description = "authentik initial akadmin superuser password"
  type        = string
  default     = "adminpassword"
  sensitive   = true
}
