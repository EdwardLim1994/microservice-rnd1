variable "namespace" {
  description = "Kubernetes namespace leave is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the leave runtime image, built into minikube's docker daemon"
  type        = string
}
