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
  # Router serves both the GraphQL API and its interactive Sandbox playground at the same
  # path (/graphql) — content-negotiated on the request's Accept header, browser gets the UI.
  [8105]="infra svc/apollo-router 80 18086"
  [8110]="infra svc/kafka-ui 8080 18087"
  # Meilisearch serves its own web UI (index/document browser) at "/" on the same port as its
  # HTTP API — no separate dashboard port to forward.
  [8115]="infra svc/meilisearch 7700 18088"
  # apps/web and apps/mfe charts, not services/* — remote port is each one's rsbuild dev-server
  # port (see their own rsbuild.config.ts) when running the Dockerfile's "development" target
  # locally. No apps/web or apps/mfe workspace currently scaffolded — add its own
  # [port]="apps svc/<name> <remote-port> <local-port>" entry here once one exists.
)

PF_PIDS=()

cleanup() {
  tailscale serve reset
  for pid in "${PF_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

# Self DNSName only — `tailscale status --self --json` still lists every peer despite the flag,
# so take the first entry (this machine's own). Trailing dot stripped (FQDN root dot, not part
# of the actual hostname).
tailnet_host=$(tailscale status --self --json | grep -m1 '"DNSName"' | cut -d'"' -f4 | sed 's/\.$//')

echo "Forwarding:"
for tailscale_port in "${!APPS[@]}"; do
  read -r namespace svc remote_port local_port <<<"${APPS[$tailscale_port]}"
  printf '  https://%s:%s  ->  %s/%s\n' "$tailnet_host" "$tailscale_port" "$namespace" "${svc#svc/}"
done
echo

for tailscale_port in "${!APPS[@]}"; do
  read -r namespace svc remote_port local_port <<<"${APPS[$tailscale_port]}"
  kubectl port-forward -n "$namespace" "$svc" "$local_port:$remote_port" &
  PF_PIDS+=("$!")
  tailscale serve --bg --https="$tailscale_port" "http://localhost:$local_port"
done

wait
