module "authentik" {
  source = "./module"

  namespace           = var.namespace
  secret_key          = var.secret_key
  postgresql_password = var.postgresql_password
  bootstrap_password  = var.bootstrap_password
}
