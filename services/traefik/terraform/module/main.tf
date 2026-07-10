# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to traefik).

resource "helm_release" "traefik" {
  name      = "traefik"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace

  set {
    name  = "namespace"
    value = var.namespace
  }
}
