# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to meilisearch).

resource "helm_release" "meilisearch" {
  name      = "meilisearch"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "masterKey"
    value = var.master_key
  }
}
