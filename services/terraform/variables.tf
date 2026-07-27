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
