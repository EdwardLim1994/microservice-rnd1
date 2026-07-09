terraform {
  required_version = ">= 1.5"

  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.33"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.16"
    }
  }

  # Remote backend — see terraform/providers.tf's comment for why this is required for CI. This
  # root's state must use a DIFFERENT key/prefix from the app-level terraform/ root (they're
  # already separate state owners per this directory's own CLAUDE.md — nothing that applies here
  # should ever be able to touch the app-level state, and vice versa).
  backend "s3" {
    # bucket = "TODO"
    # key    = "services/terraform.tfstate"
    # region = "TODO"
    # State locking: `use_lockfile = true` (S3, Terraform >= 1.10) or `dynamodb_table = "TODO"`.
  }
}

provider "kubernetes" {
  config_path    = var.kubeconfig_path
  config_context = var.kube_context
}

provider "helm" {
  kubernetes {
    config_path    = var.kubeconfig_path
    config_context = var.kube_context
  }
}
