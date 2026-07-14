resource "kubernetes_namespace" "mfe1" {
  metadata {
    name = var.namespace
  }
}

resource "helm_release" "mfe1" {
  name = "mfe1"
  # path.module resolves relative to this file's own location on disk, not the caller's — so this
  # correctly points at this project's helm/ directory whether invoked from its own thin wrapper
  # (source = "./module") or from the root terraform config (source =
  # "../frontends/mfe1/terraform/module"). abspath() normalizes the result so both
  # callers (different relative depth to this module) resolve to the same `chart` attribute
  # string for the same real directory — see servers/demo1/terraform/module/main.tf for the
  # concrete gotcha this avoids (a spurious helm_release diff on every plan otherwise).
  chart     = abspath("${path.module}/../../helm")
  namespace = kubernetes_namespace.mfe1.metadata[0].name
  timeout   = 600

  set {
    name  = "image.app.tag"
    value = var.app_image_tag
  }
}
