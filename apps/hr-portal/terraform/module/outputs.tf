output "namespace" {
  value = kubernetes_namespace.hr-portal.metadata[0].name
}

output "release_status" {
  value = helm_release.hr-portal.status
}
