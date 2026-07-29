#!/usr/bin/env bash
# Single port-forward to traefik (namespace infra) — every app (grafana, vault,
# authentik, minio, argocd once deployed) routes through it by Host header, so
# one forward covers all of them instead of one per service.
set -euo pipefail

kubectl port-forward -n infra svc/traefik --address 0.0.0.0 8080:80 8443:443
