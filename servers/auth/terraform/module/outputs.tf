output "namespace" {
  value = kubernetes_namespace.auth.metadata[0].name
}

output "release_status" {
  value = helm_release.auth.status
}
