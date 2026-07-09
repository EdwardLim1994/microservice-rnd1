module "vault" {
  source = "./module"

  namespace         = var.namespace
  dev_root_token_id = var.dev_root_token_id
}
