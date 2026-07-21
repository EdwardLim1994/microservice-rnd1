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

variable "auth_namespace" {
  description = "Kubernetes namespace auth is deployed into"
  type        = string
  default     = "auth"
}

variable "auth_app_image_tag" {
  description = "Tag of the auth runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}

variable "docs_namespace" {
  description = "Kubernetes namespace docs is deployed into"
  type        = string
  default     = "docs"
}

variable "docs_app_image_tag" {
  description = "Tag of the docs runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}

variable "employee_namespace" {
  description = "Kubernetes namespace employee is deployed into"
  type        = string
  default     = "employee"
}

variable "employee_app_image_tag" {
  description = "Tag of the employee runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}

variable "hr_portal_namespace" {
  description = "Kubernetes namespace hr-portal is deployed into"
  type        = string
  default     = "hr-portal"
}

variable "hr_portal_app_image_tag" {
  description = "Tag of the hr-portal runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}
