# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to monitoring).

resource "helm_release" "monitoring" {
  name      = "monitoring"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace
  timeout   = 600

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "grafana.adminUser"
    value = var.grafana_admin_user
  }

  set {
    name  = "grafana.adminPassword"
    value = var.grafana_admin_password
  }
}
