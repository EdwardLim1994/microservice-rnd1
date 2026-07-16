variable "namespace" {
  description = "Kubernetes namespace docs is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the docs runtime image, built into minikube's docker daemon"
  type        = string
}
