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

# Shared in-cluster Kafka/Schema Registry addresses — fixed, environment-wide, not per-app (see
# servers/test1/terraform/module/variables.tf's own defaults, which these match).
variable "kafka_brokers" {
  description = "Kafka bootstrap brokers"
  type        = string
  default     = "kafka.infra.svc.cluster.local:9092"
}

variable "schema_registry_url" {
  description = "Confluent Schema Registry URL"
  type        = string
  default     = "http://schema-registry.infra.svc.cluster.local:8081"
}

variable "test1_namespace" {
  description = "Kubernetes namespace test1 is deployed into"
  type        = string
  default     = "test1"
}

variable "test1_app_image_tag" {
  description = "Tag of the test1 runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}

variable "test2_namespace" {
  description = "Kubernetes namespace test2 is deployed into"
  type        = string
  default     = "test2"
}

variable "test2_app_image_tag" {
  description = "Tag of the test2 runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}

variable "mfe1_namespace" {
  description = "Kubernetes namespace mfe1 is deployed into"
  type        = string
  default     = "mfe1"
}

variable "mfe1_app_image_tag" {
  description = "Tag of the mfe1 runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}

variable "web1_namespace" {
  description = "Kubernetes namespace web1 is deployed into"
  type        = string
  default     = "web1"
}

variable "web1_app_image_tag" {
  description = "Tag of the web1 runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}
