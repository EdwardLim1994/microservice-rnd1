output "namespace" {
  value = kubernetes_namespace.leave.metadata[0].name
}

output "release_status" {
  value = helm_release.leave.status
}
