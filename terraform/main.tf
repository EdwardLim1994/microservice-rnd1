# One module block per app under servers/**, frontends/**, apps/** — each pointing at that app's
# own terraform/module (no resource logic duplicated here; see servers/demo1/terraform/module).
# To add a new app: give it the same servers/<app>/terraform/{module,providers.tf,variables.tf,
# main.tf} shape as demo1 (module/ has no provider blocks — those live only here and in each
# app's own thin per-app wrapper), then add a matching module block below.

module "auth" {
  source = "../servers/auth/terraform/module"

  namespace     = var.auth_namespace
  app_image_tag = var.auth_app_image_tag
}
