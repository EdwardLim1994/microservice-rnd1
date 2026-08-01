variable "kubeconfig" {
  description = "Path to kubeconfig. Point this at k3d's for local, a real cluster's for prod."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "kubeconfig context to deploy into (e.g. \"k3d-dev\", k3d's default naming for a cluster created as `k3d cluster create dev`)."
  type        = string
  default     = "k3d-dev"
}
