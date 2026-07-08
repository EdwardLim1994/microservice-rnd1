module "web1" {
  source = "./module"

  namespace     = var.namespace
  app_image_tag = var.app_image_tag
}
