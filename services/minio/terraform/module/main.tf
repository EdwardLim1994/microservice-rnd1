# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to minio).

resource "helm_release" "minio" {
  name      = "minio"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace
  timeout   = 600

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "rootUser"
    value = var.root_user
  }

  set {
    name  = "rootPassword"
    value = var.root_password
  }
}
