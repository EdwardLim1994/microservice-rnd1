variable "namespace" {
  description = "Kubernetes namespace hr-portal is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the hr-portal runtime image, built into minikube's docker daemon"
  type        = string
}
