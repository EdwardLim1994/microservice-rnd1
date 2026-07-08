variable "namespace" {
  description = "Kubernetes namespace {{ name }} is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the {{ name }} runtime image, built into minikube's docker daemon"
  type        = string
}
