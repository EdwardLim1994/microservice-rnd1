set -e
NEW_USER=$(cat /shared/new_user)
NEW_PASS=$(cat /shared/new_pass)
NEW_LEASE=$(cat /shared/new_lease)
VAULT_TOKEN=$(cat /shared/vault_token)

# -n "$APP_NAMESPACE" on every kubectl call below — see db-provision-main.sh's own comment.
#
# Skip the patch/rollout entirely if the app chart's own Secret doesn't exist yet — see
# db-provision-main.sh's own comment for why (same self-healing story via this Job's CronJob).
if kubectl get secret server1-grpc-redis-secret -n "$APP_NAMESPACE" >/dev/null 2>&1; then
  PREV_LEASE=$(kubectl get secret server1-grpc-redis-secret -n "$APP_NAMESPACE" -o jsonpath='{.metadata.annotations.vault\.lease-id}' 2>/dev/null || true)

  # Fully-qualified, not bare "server1-grpc-redis" — this URL is read by the app's own
  # Deployment pod, which lives in server-apps, a different namespace than
  # server1-grpc-redis.
  REDIS_URL="redis://${NEW_USER}:${NEW_PASS}@server1-grpc-redis.server-infra.svc.cluster.local:6379"
  B64_URL=$(printf '%s' "$REDIS_URL" | base64 | tr -d '\n')
  kubectl patch secret server1-grpc-redis-secret -n "$APP_NAMESPACE" --type merge \
    -p "{\"data\":{\"REDIS_URL\":\"$B64_URL\"}}"
  kubectl annotate secret server1-grpc-redis-secret -n "$APP_NAMESPACE" "vault.lease-id=$NEW_LEASE" --overwrite

  # Skip if the app chart's own Deployment hasn't been created yet either — see
  # db-provision-main.sh's own comment for why.
  if kubectl get deployment/server1-grpc -n "$APP_NAMESPACE" >/dev/null 2>&1; then
    kubectl rollout restart deployment/server1-grpc -n "$APP_NAMESPACE"
    kubectl rollout status deployment/server1-grpc -n "$APP_NAMESPACE" --timeout=5m
  fi
else
  PREV_LEASE=""
fi

if [ -n "$PREV_LEASE" ]; then
  echo "revoking previous lease $PREV_LEASE"
  curl -sf -X PUT -H "X-Vault-Token: $VAULT_TOKEN" \
    -d "{\"lease_id\":\"$PREV_LEASE\"}" \
    "$VAULT_ADDR/v1/sys/leases/revoke" || true
fi
