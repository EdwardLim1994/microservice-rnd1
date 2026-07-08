output "namespace" {
  value = kubernetes_namespace.{{ name }}.metadata[0].name
}

output "release_status" {
  value = helm_release.{{ name }}.status
}
