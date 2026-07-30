set -e
NEW_USER=$(cat /shared/new_user)
NEW_PASS=$(cat /shared/new_pass)
NEW_LEASE=$(cat /shared/new_lease)
VAULT_TOKEN=$(cat /shared/vault_token)

PREV_LEASE=$(kubectl get secret server1-redis-secret -o jsonpath='{.metadata.annotations.vault\.lease-id}' 2>/dev/null || true)

REDIS_URL="redis://${NEW_USER}:${NEW_PASS}@server1-redis:6379"
B64_URL=$(printf '%s' "$REDIS_URL" | base64 | tr -d '\n')
kubectl patch secret server1-redis-secret --type merge \
  -p "{\"data\":{\"REDIS_URL\":\"$B64_URL\"}}"
kubectl annotate secret server1-redis-secret "vault.lease-id=$NEW_LEASE" --overwrite

kubectl rollout restart deployment/server1
kubectl rollout status deployment/server1 --timeout=5m

if [ -n "$PREV_LEASE" ]; then
  echo "revoking previous lease $PREV_LEASE"
  curl -sf -X PUT -H "X-Vault-Token: $VAULT_TOKEN" \
    -d "{\"lease_id\":\"$PREV_LEASE\"}" \
    "$VAULT_ADDR/v1/sys/leases/revoke" || true
fi
