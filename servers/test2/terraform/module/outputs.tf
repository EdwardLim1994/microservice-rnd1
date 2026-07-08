output "namespace" {
  value = kubernetes_namespace.test2.metadata[0].name
}

output "release_status" {
  value = helm_release.test2.status
}
