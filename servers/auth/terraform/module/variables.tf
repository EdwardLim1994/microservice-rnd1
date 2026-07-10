variable "namespace" {
  description = "Kubernetes namespace auth is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the auth runtime image, built into minikube's docker daemon"
  type        = string
}
