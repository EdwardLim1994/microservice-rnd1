variable "namespace" {
  description = "Kubernetes namespace employee is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the employee runtime image, built into minikube's docker daemon"
  type        = string
}
