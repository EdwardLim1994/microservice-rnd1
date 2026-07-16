output "namespace" {
  value = kubernetes_namespace.docs.metadata[0].name
}

output "release_status" {
  value = helm_release.docs.status
}
