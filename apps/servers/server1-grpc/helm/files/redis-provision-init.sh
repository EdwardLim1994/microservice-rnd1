set -e
until vault status >/dev/null 2>&1; do
  echo "waiting for vault..."
  sleep 2
done

JWT=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
export VAULT_TOKEN=$(vault write -field=token auth/kubernetes/login role=db-provision jwt="$JWT")

vault secrets enable database 2>/dev/null || true

# Unlike the postgresql-database-plugin, Vault's redis-database-plugin takes discrete
# host/port/username/password fields (no connection_url template placeholders), and mints/revokes
# ACL users itself — no creation_statements/revocation_statements SQL to hand it.
#
# Fully-qualified, not bare "server1-grpc-redis" — this connection is made by Vault itself, running
# in a different namespace (services/vault's "infra") than server1-grpc-redis ("servers"), and Vault
# maintains/reuses this connection for every future `vault read database/creds/...` too, not
# just this one write. Bare service names only resolve within the resolving pod's own namespace.
vault write database/config/server1-grpc-redis \
  plugin_name=redis-database-plugin \
  host=server1-grpc-redis.servers.svc.cluster.local \
  port=6379 \
  tls=false \
  username=default \
  password="$REDIS_ADMIN_PASSWORD" \
  allowed_roles="server1-grpc-redis-role"

vault write database/roles/server1-grpc-redis-role \
  db_name=server1-grpc-redis \
  creation_statements='["+@all","~*"]' \
  default_ttl="$DB_DEFAULT_TTL" \
  max_ttl="$DB_MAX_TTL"

vault read database/creds/server1-grpc-redis-role > /tmp/creds
awk '$1 == "username" { print $2 }' /tmp/creds > /shared/new_user
awk '$1 == "password" { print $2 }' /tmp/creds > /shared/new_pass
awk '$1 == "lease_id" { print $2 }' /tmp/creds > /shared/new_lease
printf '%s' "$VAULT_TOKEN" > /shared/vault_token
