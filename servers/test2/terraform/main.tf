module "test2" {
  source = "./module"

  namespace     = var.namespace
  app_image_tag = var.app_image_tag
  kafka_brokers       = var.kafka_brokers
  schema_registry_url = var.schema_registry_url
}
