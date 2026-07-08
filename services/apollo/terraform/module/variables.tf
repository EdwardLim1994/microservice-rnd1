variable "namespace" {
  description = "Kubernetes namespace apollo-router is deployed into (shared with kafka/redis — must already exist)"
  type        = string
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
