# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to redis).

resource "helm_release" "redis" {
  name      = "redis"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace
  timeout   = 600

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "password"
    value = var.password
  }
}
