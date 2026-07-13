# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to authentik).

resource "helm_release" "authentik" {
  name      = "authentik"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "secretKey"
    value = var.secret_key
  }

  set {
    name  = "postgresql.password"
    value = var.postgresql_password
  }

  set {
    name  = "bootstrap.password"
    value = var.bootstrap_password
  }

  set {
    name  = "bootstrap.token"
    value = var.bootstrap_token
  }
}
