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

variable "auth_namespace" {
  description = "Kubernetes namespace auth is deployed into"
  type        = string
  default     = "auth"
}

variable "auth_app_image_tag" {
  description = "Tag of the auth runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}
