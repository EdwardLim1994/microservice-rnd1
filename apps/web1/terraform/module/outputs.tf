output "namespace" {
  value = kubernetes_namespace.web1.metadata[0].name
}

output "release_status" {
  value = helm_release.web1.status
}
