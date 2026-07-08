variable "namespace" {
  description = "Kubernetes namespace kafka is deployed into (shared with redis/apollo — must already exist)"
  type        = string
}
