module "redis" {
  source = "./module"

  namespace = var.namespace
  password  = var.password
}
