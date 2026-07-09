module "meilisearch" {
  source = "./module"

  namespace  = var.namespace
  master_key = var.master_key
}
