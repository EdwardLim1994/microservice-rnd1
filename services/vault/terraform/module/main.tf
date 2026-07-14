# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to vault).

resource "helm_release" "vault" {
  name      = "vault"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace
  timeout   = 600

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "devRootTokenId"
    value = var.dev_root_token_id
  }
}
