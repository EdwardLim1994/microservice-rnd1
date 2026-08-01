#!/usr/bin/env bash
# Wraps `terraform apply` in services/terraform with the two-phase apply a truly fresh cluster
# needs. provider "helm"'s `experiments.manifest = true` (services/terraform/versions.tf) renders
# every chart's manifest during the *plan* pass, before anything in this apply has actually been
# created yet — charts that `lookup()` another chart's live Service IP (minio/vault baking
# traefik's ClusterIP into an "authentik.lan" hostAlias, see main.tf's own comments on
# helm_release.traefik/helm_release.vault) get that chart's fallback value (127.0.0.1) baked into
# the plan. By the time Terraform actually executes those resources moments later — correctly
# *after* traefik/authentik, thanks to depends_on — the provider re-renders and finds the real
# IP: a different value than the plan already committed to, which fails hard with "Provider
# produced inconsistent final plan". `depends_on` only fixes execution *order*, not this — plan
# is computed for every resource up front regardless of ordering. Once traefik/authentik exist
# (from this script's first pass), every later plan+apply agrees with itself and this never
# recurs, so this two-phase dance is only needed once per fresh cluster.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../services/terraform"

terraform init -input=false

# First pass: create just the resources everything else's `lookup()` depends on. Ignores its own
# exit code — a from-scratch cluster still hits the exact "inconsistent final plan" error on
# whichever *other* resource applies right after traefik/authentik in this same first pass (same
# root cause, one level removed); what matters is that traefik + authentik themselves land.
terraform apply -auto-approve \
  -target=helm_release.traefik \
  -target='helm_release.service["authentik"]' \
  || true

# Second pass: a normal, full apply. traefik/authentik already exist, so this plan's `lookup()`
# calls see their real values from the start — no more plan-vs-apply divergence.
terraform apply -auto-approve
