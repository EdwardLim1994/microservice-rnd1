variable "namespace" {
  description = "Kubernetes namespace traefik is deployed into (shared with kafka/redis/apollo-router/etc — must already exist)"
  type        = string
}
