resource "kubernetes_namespace" "test1" {
  metadata {
    name = var.namespace
  }
}

resource "helm_release" "test1" {
  name      = "test1"
  # path.module resolves relative to this file's own location on disk, not the caller's — so this
  # correctly points at this server's helm/ directory whether invoked from this server's own
  # thin wrapper (source = "./module") or from the root terraform config
  # (source = "../servers/test1/terraform/module"). abspath() normalizes the result so both
  # callers (different relative depth to this module) resolve to the same `chart` attribute
  # string for the same real directory — see servers/demo1/terraform/module/main.tf for the
  # concrete gotcha this avoids (a spurious helm_release diff on every plan otherwise).
  chart     = abspath("${path.module}/../../helm")
  namespace = kubernetes_namespace.test1.metadata[0].name

  set {
    name  = "image.app.tag"
    value = var.app_image_tag
  }

  set {
    name  = "kafka.brokers"
    value = var.kafka_brokers
  }

  set {
    name  = "schemaRegistry.url"
    value = var.schema_registry_url
  }
}
