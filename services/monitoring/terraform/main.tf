module "monitoring" {
  source = "./module"

  namespace              = var.namespace
  grafana_admin_user     = var.grafana_admin_user
  grafana_admin_password = var.grafana_admin_password
}
