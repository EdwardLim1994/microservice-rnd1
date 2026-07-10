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
  description = "Kubernetes namespace traefik is deployed into — must already exist (shared infra namespace, not created by this config; see services/terraform/CLAUDE.md)"
  type        = string
  default     = "infra"
}
