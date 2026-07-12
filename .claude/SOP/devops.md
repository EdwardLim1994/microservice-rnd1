# Role SOP — DevOps (`/devops`)

## Responsibility
Provision and update infrastructure using Terraform and Helm. Configure GitHub Actions workflows. Signal the developer when infrastructure is ready for deployment.

## Prerequisites (verify before acting)
```
[ ] CLAUDE.md has been read
[ ] Terraform CLI is available (terraform version)
[ ] Helm CLI is available (helm version)
[ ] GitHub CLI is authenticated (gh auth status)
[ ] Cloud provider credentials are available in environment
[ ] SONAR_TOKEN is available in environment (for GitHub Actions setup)
[ ] Rover CLI is available (rover --version) — for supergraph compose verification
```

If any prerequisite fails — post a `/blocked` comment on the release milestone and stop.

---

## DevOps is Triggered in Two Scenarios

**Scenario A — New release setup**
Triggered at the start of a release when GitHub Actions workflows need to be created or updated. Run `/devops` before `/pm` begins if workflows do not yet exist.

**Scenario B — Release deployment**
Triggered when the developer is ready to deploy the release branch to an environment. Typically after UAT sign-off.

---

## Scenario A — GitHub Actions Setup

### Step 1 — Check existing workflows
```
ls .github/workflows/
```

Required workflows:
- `integration-tests.yml` — triggers on push to `feat/**` branches
- `e2e-tests.yml` — triggers on PR opened targeting `release/**` branches (us → release)
- `sonarqube.yml` — triggers on push to `feat/**` and `us/**` branches

If any are missing — create them using the templates below.

### Integration Test Workflow
```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on:
  push:
    branches:
      - 'feat/**'
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run integration tests
        run: npm run test:integration
```

### e2e Test Workflow
e2e tests run against a local kind Kubernetes cluster. Triggered when a PR is opened to merge a user story branch into the release branch.

```yaml
# .github/workflows/e2e-tests.yml
name: e2e Tests
on:
  pull_request:
    branches:
      - 'release/**'
    # Only triggers when PR source is a user story branch
    types: [opened, synchronize, reopened]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Spin up local Kubernetes cluster
      - name: Install kind
        run: |
          curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
          chmod +x ./kind
          sudo mv ./kind /usr/local/bin/kind

      - name: Create kind cluster
        run: kind create cluster --name e2e --wait 60s

      - name: Set KUBECONFIG
        run: echo "KUBECONFIG=$(kind get kubeconfig-path --name e2e)" >> $GITHUB_ENV

      # Deploy application to kind cluster
      - name: Install Helm
        uses: azure/setup-helm@v3

      - name: Deploy application
        run: |
          helm upgrade --install app ./helm/[chart-name]             --namespace default             --values ./helm/values/e2e.yaml             --wait             --timeout 5m

      # Expose cluster URL for tests
      - name: Get cluster URL
        run: |
          kubectl port-forward svc/[service-name] 8080:80 &
          echo "CLUSTER_URL=http://localhost:8080" >> $GITHUB_ENV
          sleep 5  # wait for port-forward to be ready

      # Setup Bun and run e2e tests
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install e2e dependencies
        working-directory: ./e2e
        run: bun install

      - name: Run Vitest API tests
        working-directory: ./e2e
        run: bun run test:api
        env:
          CLUSTER_URL: ${{ env.CLUSTER_URL }}

      - name: Run Cypress browser tests
        working-directory: ./e2e
        run: bun run test:e2e
        env:
          CLUSTER_URL: ${{ env.CLUSTER_URL }}

      - name: Upload Cypress screenshots on failure
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: cypress-screenshots
          path: ./e2e/cypress/screenshots/
          retention-days: 7

      - name: Upload Cypress videos
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: cypress-videos
          path: ./e2e/cypress/videos/
          retention-days: 7

      # Tear down cluster
      - name: Delete kind cluster
        if: always()
        run: kind delete cluster --name e2e
```

> **Note on remote cluster:** To run e2e against a remote staging cluster instead of kind, replace the kind setup/teardown steps with kubeconfig authentication steps and set `CLUSTER_URL` to the remote cluster's ingress URL. No changes to test code are needed.

### SonarQube Workflow
```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Scan
on:
  push:
    branches:
      - 'feat/**'
      - 'us/**'
jobs:
  sonarqube:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: SonarQube Scan
        uses: SonarSource/sonarqube-scan-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
          SONAR_HOST_URL: https://sonarcloud.io
```

### Step 2 — Verify secrets are configured
Confirm the following GitHub repository secrets exist:
```
gh secret list
```

Required secrets:
- `SONAR_TOKEN` — SonarQube Cloud token

If missing — notify the developer:
```
/blocked
Role: devops
Issue: SONAR_TOKEN secret is not configured in GitHub repository secrets
Waiting for: Developer to add the secret via GitHub repository settings → Secrets and variables → Actions
```

### Step 3 — Commit workflows
```
git checkout release/[release-name]
git add .github/workflows/
git commit -m "chore(ci): add github actions workflows for integration tests, e2e, and sonarqube"
git push origin release/[release-name]
```

### Step 4 — Verify Rover CLI
```bash
rover --version

# If not installed:
curl -sSL https://rover.apollo.dev/nix/latest | sh
```

Confirm `./supergraph.yaml` exists in the repo root. If not, create it:
```yaml
# supergraph.yaml
federation_version: =2.0.0
subgraphs:
  auth-subgraph:
    routing_url: http://auth-subgraph:4001/graphql
    schema:
      file: ./servers/auth-subgraph/src/schema/schema.graphql
  order-subgraph:
    routing_url: http://order-subgraph:4002/graphql
    schema:
      file: ./servers/order-subgraph/src/schema/schema.graphql
  # add further subgraphs as the monorepo grows
```

### Step 5 — Handoff to PM
Post comment on release milestone:
```
/handoff pm
GitHub Actions workflows created/verified:
- integration-tests.yml ✅
- e2e-tests.yml ✅
- sonarqube.yml ✅
- SONAR_TOKEN secret: ✅ confirmed
- Rover CLI: ✅ installed
- supergraph.yaml: ✅ verified
Status: CI/CD pipeline ready. Project Management can begin.
```

---

## Scenario B — Release Deployment

### Step 1 — Read inputs
```
1. Read .claude/requirements/[release-name].md for release scope
2. Identify any infrastructure changes required by this release:
   - New services or endpoints
   - New environment variables or secrets
   - Scaling or resource changes
   - New dependencies (databases, queues, storage)
```

### Step 1b — Verify Supergraph Compose (if any feature had graphqlChanges: true)

Before applying infrastructure changes, verify the updated subgraph SDLs compose correctly:

```bash
# Check if any release features involved GraphQL changes
cat .openspec/requirements/release/[version]/requirements.yaml | grep "graphqlChanges: true"

# If any graphqlChanges: true found — run Rover compose
rover supergraph compose --config ./supergraph.yaml

# If compose fails — post /blocked on the release milestone
# Do not proceed with deployment until compose passes
```

If compose passes, update the supergraph schema in the Apollo Router config:
```bash
rover supergraph compose --config ./supergraph.yaml > ./apollo-router/supergraph.graphql
git add ./apollo-router/supergraph.graphql
git commit -m "chore(router): update supergraph schema for [version]"
git push origin release/[version]
```

### Step 2 — Terraform

```
cd terraform/

# Review planned changes
terraform plan -var-file="environments/[environment].tfvars"

# Review the plan output carefully before applying
# Stop and notify developer if any destructive changes (destroy) are in the plan
```

If the plan contains destructive changes:
```
/blocked
Role: devops
Issue: Terraform plan contains destructive changes for [environment]
Waiting for: Developer approval before applying
Terraform plan output: [paste relevant section]
```

If the plan is safe to apply:
```
terraform apply -var-file="environments/[environment].tfvars" -auto-approve
```

### Step 3 — Helm

```
# Update Helm chart values for the release
helm upgrade [release-name] ./helm/[chart-name] \
  --namespace [namespace] \
  --values helm/values/[environment].yaml \
  --set image.tag=[release-name] \
  --atomic \
  --timeout 5m
```

If Helm upgrade fails:
```
helm rollback [release-name] --namespace [namespace]
```

Then post `/blocked` on the release milestone with the error output.

### Step 4 — Verify deployment
```
# Confirm pods are running
kubectl get pods -n [namespace]

# Check logs for errors
kubectl logs -n [namespace] -l app=[app-name] --tail=50

# Confirm health endpoint responds
curl -f https://[environment-url]/health
```

### Step 5 — Handoff to developer
Post comment on release milestone:
```
/handoff deploy
Release: [release-name]
Environment: [staging | production]
Terraform: ✅ applied
Helm: ✅ [release-name] upgraded
Health check: ✅ [environment-url]/health responding
Status: Infrastructure ready. UAT can proceed.
```

---

## Stopping Conditions

Post a `/blocked` comment on the release milestone and stop if:
- Terraform or Helm CLI is unavailable
- Cloud provider credentials are missing or expired
- Terraform plan contains destructive changes (wait for developer approval)
- Terraform apply fails
- Helm upgrade fails and rollback is required
- Health check fails after deployment
- Rover supergraph compose fails — fix subgraph SDL before deployment
- GitHub repository secrets are not configured
- `kubectl` cannot connect to the cluster