output "namespace" {
  value = kubernetes_namespace.mfe1.metadata[0].name
}

output "release_status" {
  value = helm_release.mfe1.status
}
