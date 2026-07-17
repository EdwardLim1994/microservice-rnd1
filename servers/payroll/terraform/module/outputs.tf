output "namespace" {
  value = kubernetes_namespace.payroll.metadata[0].name
}

output "release_status" {
  value = helm_release.payroll.status
}
