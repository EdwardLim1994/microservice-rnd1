set -e
until vault status >/dev/null 2>&1; do
  echo "waiting for vault..."
  sleep 2
done

JWT=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
export VAULT_TOKEN=$(vault write -field=token auth/kubernetes/login role=db-provision jwt="$JWT")

vault secrets enable database 2>/dev/null || true

# Fully-qualified, not bare "server1-grpc-db" — this connection is made by Vault itself, running in
# a different namespace (services/vault's "infra") than server1-grpc-db ("servers"), and Vault
# maintains/reuses this connection for every future `vault read database/creds/...` too, not
# just this one write. Bare service names only resolve within the resolving pod's own namespace,
# so Vault's own DNS search domain (infra) can't find a bare "server1-grpc-db" that only exists in a
# different namespace.
vault write database/config/server1-grpc-postgresql \
  plugin_name=postgresql-database-plugin \
  connection_url="postgresql://{{username}}:{{password}}@server1-grpc-db.servers.svc.cluster.local:5432/server1-grpc?sslmode=disable" \
  username="myuser" \
  password="$PGADMIN_PASSWORD" \
  allowed_roles="server1-grpc-role"

# IN ROLE myuser makes the minted role a member of the existing "myuser" superuser rather than
# granting fresh DB-level privileges — myuser already owns every table from past migrations (see
# server1-grpc-migrate in db.yaml), and only membership (inheriting its grants) lets the new login
# read/write them.
vault write database/roles/server1-grpc-role \
  db_name=server1-grpc-postgresql \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}' IN ROLE myuser;" \
  revocation_statements="REASSIGN OWNED BY \"{{name}}\" TO myuser; DROP OWNED BY \"{{name}}\"; DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="$DB_DEFAULT_TTL" \
  max_ttl="$DB_MAX_TTL"

# One read only — database/creds/server1-grpc-role is a dynamic-secret endpoint that mints a
# brand-new role on every single read. Separate `vault read` calls per field would mint separate
# roles and hand back credentials that don't match each other.
vault read database/creds/server1-grpc-role > /tmp/creds
awk '$1 == "username" { print $2 }' /tmp/creds > /shared/new_user
awk '$1 == "password" { print $2 }' /tmp/creds > /shared/new_pass
awk '$1 == "lease_id" { print $2 }' /tmp/creds > /shared/new_lease
printf '%s' "$VAULT_TOKEN" > /shared/vault_token
