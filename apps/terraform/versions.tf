terraform {
  required_version = ">= 1.5"

  required_providers {
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.14"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "helm" {
  kubernetes {
    config_path    = var.kubeconfig
    config_context = var.kube_context
  }

  # See services/terraform/versions.tf's identical block for why this is on: without it, the
  # provider only diffs its own resource arguments (chart path, values, version) against state —
  # it never re-renders the local chart to check whether the *templates themselves* changed, so a
  # template-only edit here would otherwise silently no-op on `terraform apply`.
  experiments {
    manifest = true
  }
}

provider "kubernetes" {
  config_path    = var.kubeconfig
  config_context = var.kube_context
}
