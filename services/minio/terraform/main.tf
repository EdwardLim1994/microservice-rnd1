module "minio" {
  source = "./module"

  namespace     = var.namespace
  root_user     = var.root_user
  root_password = var.root_password
}
