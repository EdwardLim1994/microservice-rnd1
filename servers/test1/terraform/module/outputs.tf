output "namespace" {
  value = kubernetes_namespace.test1.metadata[0].name
}

output "release_status" {
  value = helm_release.test1.status
}
