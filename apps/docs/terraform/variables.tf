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
  description = "Kubernetes namespace docs is deployed into"
  type        = string
  default     = "docs"
}

variable "app_image_tag" {
  description = "Tag of the docs runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}
