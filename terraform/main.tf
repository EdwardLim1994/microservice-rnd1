# One module block per app under servers/**, frontends/**, apps/** — each pointing at that app's
# own terraform/module (no resource logic duplicated here; see servers/demo1/terraform/module).
# To add a new app: give it the same servers/<app>/terraform/{module,providers.tf,variables.tf,
# main.tf} shape as demo1 (module/ has no provider blocks — those live only here and in each
# app's own thin per-app wrapper), then add a matching module block below.

module "test1" {
  source = "../servers/test1/terraform/module"

  namespace           = var.test1_namespace
  app_image_tag       = var.test1_app_image_tag
  kafka_brokers       = var.kafka_brokers
  schema_registry_url = var.schema_registry_url
}

module "test2" {
  source = "../servers/test2/terraform/module"

  namespace           = var.test2_namespace
  app_image_tag       = var.test2_app_image_tag
  kafka_brokers       = var.kafka_brokers
  schema_registry_url = var.schema_registry_url
}

module "auth" {
  source = "../servers/auth/terraform/module"

  namespace     = var.auth_namespace
  app_image_tag = var.auth_app_image_tag
}

module "mfe1" {
  source = "../frontends/mfe1/terraform/module"

  namespace     = var.mfe1_namespace
  app_image_tag = var.mfe1_app_image_tag
}

module "web1" {
  source = "../apps/web1/terraform/module"

  namespace     = var.web1_namespace
  app_image_tag = var.web1_app_image_tag
}
