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

  # Remote backend, required so `terraform apply` can run from ephemeral GitHub Actions runners
  # with proper state locking — the local .tfstate this root used until now can't be shared or
  # locked across runs. Bucket/region/key are intentionally left unset: fill them in via
  # `terraform init -backend-config=...` (CI) or a local, un-committed `backend.hcl` file once
  # the target cloud/bucket is decided. See docs/ci-cd.md.
  #
  # This root is shared by both the `uat` and `prod` CD stages via Terraform workspaces
  # (`terraform workspace select uat` / `prod`), not separate backend keys — the workspace name
  # is automatically appended to the state path by Terraform, so one backend block covers both.
  backend "local" {
    path = "terraform.tfstate"
    # bucket = "TODO"
    # key    = "apps/terraform.tfstate"
    # region = "TODO"
    # State locking: either `use_lockfile = true` (S3 native locking, Terraform >= 1.10) or a
    # `dynamodb_table = "TODO"` if using an older locking mechanism. GCS backend has native
    # locking built in and needs no lock table equivalent.
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
