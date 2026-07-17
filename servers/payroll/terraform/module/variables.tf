variable "namespace" {
  description = "Kubernetes namespace payroll is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the payroll runtime image, built into minikube's docker daemon"
  type        = string
}
