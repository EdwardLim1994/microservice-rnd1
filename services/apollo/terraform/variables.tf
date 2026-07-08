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
  description = "Kubernetes namespace apollo-router is deployed into — must already exist (shared infra namespace, not created by this config; see services/terraform/CLAUDE.md)"
  type        = string
  default     = "infra"
}

variable "demo1_subgraph_url" {
  description = "Routing URL the Router uses to reach demo1's GraphQL subgraph"
  type        = string
  default     = "http://demo1.demo1.svc.cluster.local:4001"
}

variable "demo2_subgraph_url" {
  description = "Routing URL the Router uses to reach demo2's GraphQL subgraph"
  type        = string
  default     = "http://demo2.demo2.svc.cluster.local:4003"
}
