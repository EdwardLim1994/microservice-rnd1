variable "kubeconfig" {
  description = "Path to kubeconfig. Point this at minikube's for local, a real cluster's for prod."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "kubeconfig context to deploy into (e.g. \"minikube\")."
  type        = string
  default     = "minikube"
}

variable "namespace" {
  description = "Namespace every services/* chart deploys into — matches each chart's own values.yaml."
  type        = string
  default     = "infra"
}

variable "environment" {
  description = "\"dev\" (minikube — dev-mode secrets baked into each chart's values.yaml) or \"prod\" (real cluster — each chart's own values-prod.yaml, where one exists, layers on top as an override)."
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be \"dev\" or \"prod\"."
  }
}

# Real secrets for a prod deploy — never given a default, so a prod apply fails fast instead of
# silently reusing a dev placeholder. Unused (and left unset) when environment = "dev".
variable "authentik_secret_key" {
  description = "Authentik's SECRET_KEY (prod only)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "authentik_postgres_password" {
  description = "Password for authentik-postgresql's \"authentik\" bootstrap user (prod only) — Vault takes over day-to-day DB auth after services/vault's db-provision-job runs, this is only the seed value Bitnami's postgresql chart creates the user with."
  type        = string
  default     = ""
  sensitive   = true
}

variable "authentik_bootstrap_password" {
  description = "authentik's akadmin bootstrap password, first-install only (prod only)."
  type        = string
  default     = ""
  sensitive   = true
}
