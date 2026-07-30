#!/usr/bin/env bash
# One kubectl port-forward per app, straight to its own Service — deliberately
# NOT going through traefik/Host-based routing for the tailscale path: `tailscale
# serve` forwards the client's original Host header (raspberrypi94...:8080), not
# the proxy target's host, so traefik's Host() routers never match and every
# request 404s. Port-forwarding each Service directly sidesteps Host routing
# entirely — nothing to match, just a raw TCP tunnel per app.
#
# Ctrl+C tears down every port-forward and every tailscale serve mapping (trap
# below).
#
# Requires: HTTPS certificates enabled tailnet-wide (admin console > DNS).
set -euo pipefail

# tailnet https port -> "namespace svc/name remote-port local-port"
declare -A APPS=(
  [8080]="infra svc/authentik-server 80 18081"
  [8085]="infra svc/grafana 3000 18082"
  [8090]="infra svc/vault 8200 18083"
  [8095]="infra svc/minio 9001 18084"
  [8100]="argocd svc/argocd-server 80 18085"
)

PF_PIDS=()

cleanup() {
  tailscale serve reset
  for pid in "${PF_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

for tailscale_port in "${!APPS[@]}"; do
  read -r namespace svc remote_port local_port <<<"${APPS[$tailscale_port]}"
  kubectl port-forward -n "$namespace" "$svc" "$local_port:$remote_port" &
  PF_PIDS+=("$!")
  tailscale serve --bg --https="$tailscale_port" "http://localhost:$local_port"
done

wait
