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
  description = "Kubernetes namespace authentik is deployed into — must already exist (shared infra namespace, not created by this config; see services/terraform/CLAUDE.md)"
  type        = string
  default     = "infra"
}

variable "secret_key" {
  description = "authentik secret key"
  type        = string
  default     = "changeme-generate-a-real-secret-key"
  sensitive   = true
}

variable "postgresql_password" {
  description = "authentik's dedicated Postgres password"
  type        = string
  default     = "authentikpassword"
  sensitive   = true
}

variable "bootstrap_password" {
  description = "Initial akadmin superuser password"
  type        = string
  default     = "adminpassword"
  sensitive   = true
}
