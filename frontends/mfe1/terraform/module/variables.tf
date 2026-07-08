variable "namespace" {
  description = "Kubernetes namespace mfe1 is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the mfe1 runtime image, built into minikube's docker daemon"
  type        = string
}
