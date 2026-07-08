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

variable "namespace" {
  description = "Shared Kubernetes namespace for kafka/redis/apollo-router — created once, here"
  type        = string
  default     = "infra"
}

variable "redis_password" {
  description = "Redis auth password"
  type        = string
  default     = "redispassword"
  sensitive   = true
}
