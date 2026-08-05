# OWASP ZAP Security Tests

Location: test/zap/docker-compose.yml
Scope: DAST (Dynamic Application Security Testing) against running local cluster

## Scan Types
- Baseline scan: passive only, ~2 min, run before PR
- Full scan: active attack simulation, ~15-20 min, run weekly
- API scan: OpenAPI/GraphQL spec-driven, ~5 min

## Conventions (to be established)
- Target: http://localhost (via Traefik, local k3d cluster)
- Rules file: test/zap/rules.tsv (FAIL/WARN/IGNORE per rule ID)
- Reports: test/zap/reports/ (gitignored)
- Auth: inject bearer token via ZAP replacer config

## Running Locally
cd test/zap && docker compose run zap-baseline

## Status
Infrastructure present. Rules file and auth config not yet configured.
