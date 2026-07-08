variable "namespace" {
  description = "Kubernetes namespace test1 is deployed into"
  type        = string
}

variable "app_image_tag" {
  description = "Tag of the test1 runtime image, built into minikube's docker daemon"
  type        = string
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
