# No kubernetes_namespace resource here — see services/kafka/terraform/module/main.tf's comment
# (same shared-"infra"-namespace reasoning applies identically to apollo).

resource "helm_release" "apollo_router" {
  name      = "apollo-router"
  chart     = abspath("${path.module}/../../helm")
  namespace = var.namespace

  set {
    name  = "namespace"
    value = var.namespace
  }

  set {
    name  = "subgraphs.demo1.url"
    value = var.demo1_subgraph_url
  }

  set {
    name  = "subgraphs.demo2.url"
    value = var.demo2_subgraph_url
  }
}
