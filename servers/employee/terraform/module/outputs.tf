output "namespace" {
  value = kubernetes_namespace.employee.metadata[0].name
}

output "release_status" {
  value = helm_release.employee.status
}
