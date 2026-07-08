resource "kubernetes_namespace" "{{ name }}" {
  metadata {
    name = var.namespace
  }
}

resource "helm_release" "{{ name }}" {
  name      = "{{ name }}"
  # path.module resolves relative to this file's own location on disk, not the caller's — so this
  # correctly points at this project's helm/ directory whether invoked from its own thin wrapper
  # (source = "./module") or from the root terraform config (source =
  # "../{{ location }}/{{ name }}/terraform/module"). abspath() normalizes the result so both
  # callers (different relative depth to this module) resolve to the same `chart` attribute
  # string for the same real directory — see servers/demo1/terraform/module/main.tf for the
  # concrete gotcha this avoids (a spurious helm_release diff on every plan otherwise).
  chart     = abspath("${path.module}/../../helm")
  namespace = kubernetes_namespace.{{ name }}.metadata[0].name

  set {
    name  = "image.app.tag"
    value = var.app_image_tag
  }
}
