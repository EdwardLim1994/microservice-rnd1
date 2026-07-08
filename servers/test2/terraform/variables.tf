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
  description = "Kubernetes namespace test2 is deployed into"
  type        = string
  default     = "test2"
}

variable "app_image_tag" {
  description = "Tag of the test2 runtime image, built into minikube's docker daemon"
  type        = string
  default     = "local"
}

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
