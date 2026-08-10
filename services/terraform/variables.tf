variable "kubeconfig" {
  description = "Path to kubeconfig. Point this at k3d's for local, a real cluster's for prod."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "kubeconfig context to deploy into (e.g. \"k3d-dev\", k3d's default naming for a cluster created as `k3d cluster create dev`)."
  type        = string
  default     = "k3d-dev"
}

variable "namespace" {
  description = "Namespace every services/* chart deploys into — matches each chart's own values.yaml."
  type        = string
  default     = "infra"
}

variable "environment" {
  description = "\"dev\" (minikube — dev-mode secrets baked into each chart's values.yaml) or one of the real clusters \"sit\"/\"uat\"/\"staging\"/\"prod\" (each chart's own values-nondev.yaml, where one exists, layers on top as a shared override — nothing today differs between the four real clusters, so they share one file)."
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "sit", "uat", "staging", "prod"], var.environment)
    error_message = "environment must be one of \"dev\", \"sit\", \"uat\", \"staging\", \"prod\"."
  }
}

# Real secrets for a non-dev deploy — never given a default, so a sit/uat/staging/prod apply
# fails fast instead of silently reusing a dev placeholder. Unused (and left unset) when
# environment = "dev".
variable "authentik_secret_key" {
  description = "Authentik's SECRET_KEY (non-dev only)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "authentik_postgres_password" {
  description = "Password for authentik-postgresql's \"authentik\" bootstrap user (non-dev only) — Vault takes over day-to-day DB auth after services/vault's db-provision-job runs, this is only the seed value Bitnami's postgresql chart creates the user with."
  type        = string
  default     = ""
  sensitive   = true
}

variable "authentik_bootstrap_password" {
  description = "authentik's akadmin bootstrap password, first-install only (non-dev only)."
  type        = string
  default     = ""
  sensitive   = true
}
