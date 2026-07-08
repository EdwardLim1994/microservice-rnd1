variable "namespace" {
  description = "Kubernetes namespace web1 is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the web1 runtime image, built into minikube's docker daemon"
  type        = string
}
