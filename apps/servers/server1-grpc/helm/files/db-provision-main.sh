set -e
NEW_USER=$(cat /shared/new_user)
NEW_PASS=$(cat /shared/new_pass)
NEW_LEASE=$(cat /shared/new_lease)
VAULT_TOKEN=$(cat /shared/vault_token)

PREV_LEASE=$(kubectl get secret server1-grpc-secret -o jsonpath='{.metadata.annotations.vault\.lease-id}' 2>/dev/null || true)

DATABASE_URL="postgresql://${NEW_USER}:${NEW_PASS}@server1-grpc-db:5432/server1-grpc"
B64_URL=$(printf '%s' "$DATABASE_URL" | base64 | tr -d '\n')
kubectl patch secret server1-grpc-secret --type merge \
  -p "{\"data\":{\"DATABASE_URL\":\"$B64_URL\"}}"
kubectl annotate secret server1-grpc-secret "vault.lease-id=$NEW_LEASE" --overwrite

kubectl rollout restart deployment/server1-grpc
kubectl rollout status deployment/server1-grpc --timeout=5m

if [ -n "$PREV_LEASE" ]; then
  echo "revoking previous lease $PREV_LEASE"
  curl -sf -X PUT -H "X-Vault-Token: $VAULT_TOKEN" \
    -d "{\"lease_id\":\"$PREV_LEASE\"}" \
    "$VAULT_ADDR/v1/sys/leases/revoke" || true
fi
