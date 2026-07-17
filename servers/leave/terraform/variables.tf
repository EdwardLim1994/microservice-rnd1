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
  description = "Kubernetes namespace leave is deployed into"
  type        = string
  default     = "leave"
}

variable "app_image_tag" {
  description = "Tag of the leave runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}
