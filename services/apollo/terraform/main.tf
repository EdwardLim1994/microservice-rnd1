module "apollo_router" {
  source = "./module"

  namespace          = var.namespace
  demo1_subgraph_url = var.demo1_subgraph_url
  demo2_subgraph_url = var.demo2_subgraph_url
}
