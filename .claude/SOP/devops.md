# Role SOP — DevOps (`/devops`)

## Responsibility

Configure GitHub Actions CI/CD pipelines. Manage Terraform and Helm for infrastructure.
Tag-to-deploy for UAT and production environments. Selective service deployment based
on `deployment.yaml`. No real cloud deployments yet — pipelines are structured and ready.

## Prerequisites

```
[ ] CLAUDE.md has been read
[ ] Terraform CLI available (terraform version)
[ ] Helm CLI available (helm version)
[ ] GitHub CLI authenticated (gh auth status)
[ ] Rover CLI available (rover --version)
[ ] SONAR_TOKEN secret configured in GitHub repo
[ ] ./servers/, ./frontends/, ./apps/ exist
```

---

## Scenario A — CI/CD Pipeline Setup (New Project or New Service)

Run when GitHub Actions workflows are missing or a new service is added.

### Step 1 — Verify existing workflows

```bash
ls .github/workflows/
```

Required workflows (create any that are missing):

- `integration-tests.yml` — push to `feat/**`, `bugfix/**`
- `e2e-tests.yml` — PR targeting `release/**`
- `sonarqube.yml` — push to `feat/**`, `us/**`, `bugfix/**`, `hotfix/**`
- `deploy-uat.yml` — tag matching `v*-rc*`
- `deploy-production.yml` — tag matching `v[0-9]*.[0-9]*.[0-9]*` (stable only, not rc)

No Claude Code review workflow — CI owns all scanning.

### Step 2 — Integration Tests Workflow

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on:
  push:
    branches:
      - 'feat/**'
      - 'bugfix/**'
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - name: Install dependencies
        run: bun install
      - name: Run integration tests
        run: bun run test:integration
```

### Step 3 — e2e Tests Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: e2e Tests
on:
  pull_request:
    branches:
      - 'release/**'
    types: [opened, synchronize, reopened]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install kind
        run: |
          curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
          chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

      - name: Create kind cluster
        run: kind create cluster --name e2e --wait 60s

      - name: Install Helm
        uses: azure/setup-helm@v3

      - name: Read deployment manifest
        id: deployment
        run: |
          # Extract version from PR branch name (release/[version])
          VERSION=$(echo "${{ github.head_ref }}" | sed 's/release\///')
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "manifest=.openspec/requirements/release/${VERSION}/deployment.yaml" >> $GITHUB_OUTPUT

      - name: Deploy services to kind cluster
        run: |
          MANIFEST="${{ steps.deployment.outputs.manifest }}"
          CHORE=$(yq '.chore' "${MANIFEST}")

          if [ "${CHORE}" = "true" ]; then
            echo "Chore release — skipping service deployment"
            exit 0
          fi

          # Deploy only services with deploy: true
          yq '.services[] | select(.deploy == true) | .name' "${MANIFEST}" | while read SERVICE; do
            TYPE=$(yq ".services[] | select(.name == \"${SERVICE}\") | .type" "${MANIFEST}")
            echo "Deploying ${SERVICE} (${TYPE})..."

            if [ "${TYPE}" = "mobile" ]; then
              echo "Mobile placeholder — skipping ${SERVICE}"
              continue
            fi

            helm upgrade --install "${SERVICE}" "./helm/${SERVICE}" \
              --namespace default \
              --values "./helm/values/e2e.yaml" \
              --wait --timeout 3m
          done

      - name: Get cluster URL
        run: |
          kubectl port-forward svc/gateway 8080:80 &
          echo "CLUSTER_URL=http://localhost:8080" >> $GITHUB_ENV
          sleep 5

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

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

      - name: Delete kind cluster
        if: always()
        run: kind delete cluster --name e2e
```

### Step 4 — SonarQube Workflow

```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Scan
on:
  push:
    branches:
      - 'feat/**'
      - 'us/**'
      - 'bugfix/**'
      - 'hotfix/**'
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

### Step 5 — UAT Deployment Workflow (tag-to-deploy)

Triggers on RC tags: `v*-rc*`

```yaml
# .github/workflows/deploy-uat.yml
name: Deploy to UAT
on:
  push:
    tags:
      - 'v*-rc*'

jobs:
  read-manifest:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.parse.outputs.services }}
      chore: ${{ steps.parse.outputs.chore }}
      version: ${{ steps.parse.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.ref }}

      - name: Parse deployment manifest
        id: parse
        run: |
          # Derive version from tag (v1.0.0-rc1 → 1.0.0)
          TAG="${{ github.ref_name }}"
          VERSION=$(echo "${TAG}" | sed 's/v//' | sed 's/-rc.*//')
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

          MANIFEST=".openspec/requirements/release/${VERSION}/deployment.yaml"

          # Fallback to hotfix manifest
          if [ ! -f "${MANIFEST}" ]; then
            MANIFEST=$(find .openspec/requirements/hotfix -name deployment.yaml | head -1)
          fi

          CHORE=$(yq '.chore' "${MANIFEST}")
          echo "chore=${CHORE}" >> $GITHUB_OUTPUT

          # Output list of deployable services (exclude mobile)
          SERVICES=$(yq '[.services[] | select(.deploy == true and .type != "mobile") | .name]' "${MANIFEST}")
          echo "services=${SERVICES}" >> $GITHUB_OUTPUT

  deploy:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore != 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.read-manifest.outputs.services) }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy ${{ matrix.service }} to UAT
        run: |
          echo "Deploying ${{ matrix.service }} to UAT environment"
          # Placeholder — replace with actual UAT deployment steps
          # e.g. helm upgrade --install ${{ matrix.service }} ./helm/${{ matrix.service }} \
          #   --namespace uat \
          #   --values ./helm/values/uat.yaml \
          #   --set image.tag=${{ github.ref_name }}
          echo "UAT deployment placeholder for ${{ matrix.service }} complete"

  mobile-placeholder:
    runs-on: ubuntu-latest
    steps:
      - name: Mobile build placeholder
        run: |
          echo "Mobile app (Expo) build pipeline not yet defined."
          echo "Placeholder — no action taken."
          echo "Future: integrate Expo EAS Build here."

  chore-skip:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Chore release — skip deployment
        run: |
          echo "Chore release detected — no services to deploy."
          echo "Tag: ${{ github.ref_name }}"
```

### Step 6 — Production Deployment Workflow (tag-to-deploy)

Triggers on stable tags only: `v[0-9]*.[0-9]*.[0-9]*` but NOT RC tags.

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production
on:
  push:
    tags:
      - 'v[0-9]*.[0-9]*.[0-9]*'

jobs:
  check-not-rc:
    runs-on: ubuntu-latest
    outputs:
      is_stable: ${{ steps.check.outputs.is_stable }}
    steps:
      - name: Check tag is stable (not RC)
        id: check
        run: |
          TAG="${{ github.ref_name }}"
          if [[ "${TAG}" =~ -rc[0-9]+$ ]]; then
            echo "is_stable=false" >> $GITHUB_OUTPUT
          else
            echo "is_stable=true" >> $GITHUB_OUTPUT
          fi

  read-manifest:
    needs: check-not-rc
    if: needs.check-not-rc.outputs.is_stable == 'true'
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.parse.outputs.services }}
      chore: ${{ steps.parse.outputs.chore }}
      version: ${{ steps.parse.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.ref }}

      - name: Parse deployment manifest
        id: parse
        run: |
          TAG="${{ github.ref_name }}"
          VERSION=$(echo "${TAG}" | sed 's/v//')
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

          MANIFEST=".openspec/requirements/release/${VERSION}/deployment.yaml"
          if [ ! -f "${MANIFEST}" ]; then
            MANIFEST=$(find .openspec/requirements/hotfix -name deployment.yaml | head -1)
          fi

          CHORE=$(yq '.chore' "${MANIFEST}")
          echo "chore=${CHORE}" >> $GITHUB_OUTPUT

          SERVICES=$(yq '[.services[] | select(.deploy == true and .type != "mobile") | .name]' "${MANIFEST}")
          echo "services=${SERVICES}" >> $GITHUB_OUTPUT

  deploy:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore != 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.read-manifest.outputs.services) }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy ${{ matrix.service }} to Production
        run: |
          echo "Deploying ${{ matrix.service }} to production environment"
          # Placeholder — replace with actual production deployment steps
          echo "Production deployment placeholder for ${{ matrix.service }} complete"

  mobile-placeholder:
    runs-on: ubuntu-latest
    steps:
      - name: Mobile build placeholder
        run: |
          echo "Mobile app (Expo) build pipeline not yet defined."
          echo "Placeholder — no action taken."

  chore-skip:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Chore release — skip deployment
        run: echo "Chore release — no services to deploy."
```

### Step 7 — Verify Rover CLI and supergraph.yaml

```bash
rover --version

# Create supergraph.yaml if missing
cat > supergraph.yaml << 'EOF'
federation_version: =2.0.0
subgraphs:
  # Add one entry per domain following this pattern:
  # [domain]:
  #   routing_url: http://[domain]:4001/graphql
  #   schema:
  #     file: ./servers/[domain]-subgraph/src/schema/schema.graphql
EOF
```

### Step 8 — Verify SONAR_TOKEN secret

```bash
gh secret list | grep SONAR_TOKEN
```

If missing:

```
/blocked
Role: devops
Issue: SONAR_TOKEN secret not configured
Waiting for: Developer to add via GitHub repo Settings → Secrets and variables → Actions
```

### Step 9 — Commit workflows

```bash
git checkout release/[version]   # or main for project setup
git add .github/workflows/
git add supergraph.yaml
git commit -m "chore(ci): configure github actions workflows and supergraph"
git push origin [branch]
```

### Step 10 — Handoff

```
DevOps CI/CD setup complete

Workflows configured:
  integration-tests.yml  ✅ (feat/**, bugfix/**)
  e2e-tests.yml          ✅ (PR targeting release/**)
  sonarqube.yml          ✅ (feat/**, us/**, bugfix/**, hotfix/**)
  deploy-uat.yml         ✅ (tag: v*-rc*)
  deploy-production.yml  ✅ (tag: v[0-9]*.[0-9]*.[0-9]*)

Rover CLI: ✅
SONAR_TOKEN: ✅
supergraph.yaml: ✅

Tag-to-deploy:
  RC tag (v[version]-rc[n])   → UAT environment
  Stable tag (v[version])     → Production environment
  Mobile                      → Placeholder (Expo pipeline not yet defined)
  Chore release               → No deployment

Next: /pr [version] to begin release setup
```

---

## Scenario B — Release Deployment (Rover Compose)

Triggered when a release branch is ready for deployment verification.
Rover compose is run before tagging to ensure subgraph SDL is valid.

### Step 1 — Check for GraphQL changes

```bash
VERSION="[version]"
grep "graphqlChanges: true" .openspec/requirements/release/${VERSION}/requirements.yaml
```

If no `graphqlChanges: true` found — skip Steps 2 and 3.

### Step 2 — Run Rover supergraph compose

```bash
rover supergraph compose --config ./supergraph.yaml
```

If compose fails:

```
/blocked
Role: devops
Issue: Rover supergraph compose failed
Output: [paste compose error]
Waiting for: /dev to fix subgraph SDL in ./servers/[domain]-subgraph/src/schema/
```

### Step 3 — Update supergraph schema

```bash
rover supergraph compose --config ./supergraph.yaml > ./apollo-router/supergraph.graphql
git add ./apollo-router/supergraph.graphql
git commit -m "chore(router): update supergraph schema for [version]"
git push origin release/[version]
```

---

## Stopping Conditions

Post `/blocked` on release milestone and stop if:

- Terraform or Helm CLI unavailable
- SONAR_TOKEN secret not configured
- Rover supergraph compose fails
- Terraform plan contains destructive changes (wait for developer approval)
- Helm upgrade fails
- Health check fails after deployment
- `supergraph.yaml` missing and cannot be created (no subgraph schema fi# Role SOP — DevOps (`/devops`)

## Responsibility

Configure GitHub Actions CI/CD pipelines. Manage Terraform and Helm for infrastructure.
Tag-to-deploy for UAT and production environments. Selective service deployment based
on `deployment.yaml`. No real cloud deployments yet — pipelines are structured and ready.

## Prerequisites

```
[ ] CLAUDE.md has been read
[ ] Terraform CLI available (terraform version)
[ ] Helm CLI available (helm version)
[ ] GitHub CLI authenticated (gh auth status)
[ ] Rover CLI available (rover --version)
[ ] SONAR_TOKEN secret configured in GitHub repo
[ ] ./servers/, ./frontends/, ./apps/ exist
```

---

## Scenario A — CI/CD Pipeline Setup (New Project or New Service)

Run when GitHub Actions workflows are missing or a new service is added.

### Step 1 — Verify existing workflows

```bash
ls .github/workflows/
```

Required workflows (create any that are missing):

- `integration-tests.yml` — push to `feat/**`, `bugfix/**`
- `e2e-tests.yml` — PR targeting `release/**`
- `sonarqube.yml` — push to `feat/**`, `us/**`, `bugfix/**`, `hotfix/**`
- `deploy-uat.yml` — tag matching `v*-rc*`
- `deploy-production.yml` — tag matching `v[0-9]*.[0-9]*.[0-9]*` (stable only, not rc)

No Claude Code review workflow — CI owns all scanning.

### Step 2 — Integration Tests Workflow

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests
on:
  push:
    branches:
      - 'feat/**'
      - 'bugfix/**'
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest
      - name: Install dependencies
        run: bun install
      - name: Run integration tests
        run: bun run test:integration
```

### Step 3 — e2e Tests Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: e2e Tests
on:
  pull_request:
    branches:
      - 'release/**'
    types: [opened, synchronize, reopened]
  # Manual trigger — used by /review release to run e2e on release branch
  # without needing an open PR
  workflow_dispatch:
    inputs:
      environment:
        description: 'Trigger context (e.g. review, manual)'
        required: false
        default: 'manual'

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install kind
        run: |
          curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.22.0/kind-linux-amd64
          chmod +x ./kind && sudo mv ./kind /usr/local/bin/kind

      - name: Create kind cluster
        run: kind create cluster --name e2e --wait 60s

      - name: Install Helm
        uses: azure/setup-helm@v3

      - name: Read deployment manifest
        id: deployment
        run: |
          # Extract version from PR branch name (release/[version])
          VERSION=$(echo "${{ github.head_ref }}" | sed 's/release\///')
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "manifest=.openspec/requirements/release/${VERSION}/deployment.yaml" >> $GITHUB_OUTPUT

      - name: Deploy services to kind cluster
        run: |
          MANIFEST="${{ steps.deployment.outputs.manifest }}"
          CHORE=$(yq '.chore' "${MANIFEST}")

          if [ "${CHORE}" = "true" ]; then
            echo "Chore release — skipping service deployment"
            exit 0
          fi

          # Deploy only services with deploy: true
          yq '.services[] | select(.deploy == true) | .name' "${MANIFEST}" | while read SERVICE; do
            TYPE=$(yq ".services[] | select(.name == \"${SERVICE}\") | .type" "${MANIFEST}")
            echo "Deploying ${SERVICE} (${TYPE})..."

            if [ "${TYPE}" = "mobile" ]; then
              echo "Mobile placeholder — skipping ${SERVICE}"
              continue
            fi

            helm upgrade --install "${SERVICE}" "./helm/${SERVICE}" \
              --namespace default \
              --values "./helm/values/e2e.yaml" \
              --wait --timeout 3m
          done

      - name: Get cluster URL
        run: |
          kubectl port-forward svc/gateway 8080:80 &
          echo "CLUSTER_URL=http://localhost:8080" >> $GITHUB_ENV
          sleep 5

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

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

      - name: Delete kind cluster
        if: always()
        run: kind delete cluster --name e2e

      # On e2e failure — post summary for /pr to read
      - name: Post e2e failure summary
        if: failure()
        run: |
          echo "E2E_FAILED=true" >> $GITHUB_ENV
          echo "BRANCH=${{ github.head_ref }}" >> $GITHUB_ENV

      - name: Create bugfix trigger comment on PR
        if: failure()
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          BRANCH="${{ github.head_ref }}"
          RUN_URL="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"

          gh pr comment ${PR_NUMBER} --body "
          ## e2e Test Failure

          e2e tests failed on \`${BRANCH}\`.

          **Actions run:** ${RUN_URL}

          **Failed tests:**
          \`\`\`
          $(gh run view ${{ github.run_id }} --log-failed 2>&1 | tail -50)
          \`\`\`

          **Action required:**
          Run \`/pr uat-fix\` or \`/fix pr ${PR_NUMBER}\` to create a bugfix branch and fix.
          "
```

### e2e Failure → Bugfix Flow

When e2e fails on a user story PR (us → release):

1. GitHub Actions posts a failure comment on the PR (see workflow above)
2. Developer runs `/pr uat-fix [version]` or `/fix pr [pr-number]`
3. `/pr` reads the PR comment, creates a `[BUG]` issue, creates `bugfix/[us-number]-[desc]` from `us/` branch
4. Developer runs `/fix branch bugfix/[us-number]-[desc]` to fix
5. Developer merges bugfix PR into `us/` branch
6. CI re-triggers e2e on the user story PR

### Step 4 — SonarQube Workflow

```yaml
# .github/workflows/sonarqube.yml
name: SonarQube Scan
on:
  push:
    branches:
      - 'feat/**'
      - 'us/**'
      - 'bugfix/**'
      - 'hotfix/**'
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

### Step 5 — UAT Deployment Workflow (tag-to-deploy)

Triggers on RC tags: `v*-rc*`

```yaml
# .github/workflows/deploy-uat.yml
name: Deploy to UAT
on:
  push:
    tags:
      - 'v*-rc*'

jobs:
  read-manifest:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.parse.outputs.services }}
      chore: ${{ steps.parse.outputs.chore }}
      version: ${{ steps.parse.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.ref }}

      - name: Parse deployment manifest
        id: parse
        run: |
          # Derive version from tag (v1.0.0-rc1 → 1.0.0)
          TAG="${{ github.ref_name }}"
          VERSION=$(echo "${TAG}" | sed 's/v//' | sed 's/-rc.*//')
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

          MANIFEST=".openspec/requirements/release/${VERSION}/deployment.yaml"

          # Fallback to hotfix manifest
          if [ ! -f "${MANIFEST}" ]; then
            MANIFEST=$(find .openspec/requirements/hotfix -name deployment.yaml | head -1)
          fi

          CHORE=$(yq '.chore' "${MANIFEST}")
          echo "chore=${CHORE}" >> $GITHUB_OUTPUT

          # Output list of deployable services (exclude mobile)
          SERVICES=$(yq '[.services[] | select(.deploy == true and .type != "mobile") | .name]' "${MANIFEST}")
          echo "services=${SERVICES}" >> $GITHUB_OUTPUT

  deploy:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore != 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.read-manifest.outputs.services) }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy ${{ matrix.service }} to UAT
        run: |
          echo "Deploying ${{ matrix.service }} to UAT environment"
          # Placeholder — replace with actual UAT deployment steps
          # e.g. helm upgrade --install ${{ matrix.service }} ./helm/${{ matrix.service }} \
          #   --namespace uat \
          #   --values ./helm/values/uat.yaml \
          #   --set image.tag=${{ github.ref_name }}
          echo "UAT deployment placeholder for ${{ matrix.service }} complete"

  mobile-placeholder:
    runs-on: ubuntu-latest
    steps:
      - name: Mobile build placeholder
        run: |
          echo "Mobile app (Expo) build pipeline not yet defined."
          echo "Placeholder — no action taken."
          echo "Future: integrate Expo EAS Build here."

  chore-skip:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Chore release — skip deployment
        run: |
          echo "Chore release detected — no services to deploy."
          echo "Tag: ${{ github.ref_name }}"
```

### Step 6 — Production Deployment Workflow (tag-to-deploy)

Triggers on stable tags only: `v[0-9]*.[0-9]*.[0-9]*` but NOT RC tags.

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production
on:
  push:
    tags:
      - 'v[0-9]*.[0-9]*.[0-9]*'

jobs:
  check-not-rc:
    runs-on: ubuntu-latest
    outputs:
      is_stable: ${{ steps.check.outputs.is_stable }}
    steps:
      - name: Check tag is stable (not RC)
        id: check
        run: |
          TAG="${{ github.ref_name }}"
          if [[ "${TAG}" =~ -rc[0-9]+$ ]]; then
            echo "is_stable=false" >> $GITHUB_OUTPUT
          else
            echo "is_stable=true" >> $GITHUB_OUTPUT
          fi

  read-manifest:
    needs: check-not-rc
    if: needs.check-not-rc.outputs.is_stable == 'true'
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.parse.outputs.services }}
      chore: ${{ steps.parse.outputs.chore }}
      version: ${{ steps.parse.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.ref }}

      - name: Parse deployment manifest
        id: parse
        run: |
          TAG="${{ github.ref_name }}"
          VERSION=$(echo "${TAG}" | sed 's/v//')
          echo "version=${VERSION}" >> $GITHUB_OUTPUT

          MANIFEST=".openspec/requirements/release/${VERSION}/deployment.yaml"
          if [ ! -f "${MANIFEST}" ]; then
            MANIFEST=$(find .openspec/requirements/hotfix -name deployment.yaml | head -1)
          fi

          CHORE=$(yq '.chore' "${MANIFEST}")
          echo "chore=${CHORE}" >> $GITHUB_OUTPUT

          SERVICES=$(yq '[.services[] | select(.deploy == true and .type != "mobile") | .name]' "${MANIFEST}")
          echo "services=${SERVICES}" >> $GITHUB_OUTPUT

  deploy:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore != 'true'
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.read-manifest.outputs.services) }}
    steps:
      - uses: actions/checkout@v4

      - name: Deploy ${{ matrix.service }} to Production
        run: |
          echo "Deploying ${{ matrix.service }} to production environment"
          # Placeholder — replace with actual production deployment steps
          echo "Production deployment placeholder for ${{ matrix.service }} complete"

  mobile-placeholder:
    runs-on: ubuntu-latest
    steps:
      - name: Mobile build placeholder
        run: |
          echo "Mobile app (Expo) build pipeline not yet defined."
          echo "Placeholder — no action taken."

  chore-skip:
    needs: read-manifest
    if: needs.read-manifest.outputs.chore == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Chore release — skip deployment
        run: echo "Chore release — no services to deploy."
```

### Step 7 — Verify Rover CLI and supergraph.yaml

```bash
rover --version

# Create supergraph.yaml if missing
cat > supergraph.yaml << 'EOF'
federation_version: =2.0.0
subgraphs:
  # Add one entry per domain following this pattern:
  # [domain]:
  #   routing_url: http://[domain]:4001/graphql
  #   schema:
  #     file: ./servers/[domain]-subgraph/src/schema/schema.graphql
EOF
```

### Step 8 — Verify SONAR_TOKEN secret

```bash
gh secret list | grep SONAR_TOKEN
```

If missing:

```
/blocked
Role: devops
Issue: SONAR_TOKEN secret not configured
Waiting for: Developer to add via GitHub repo Settings → Secrets and variables → Actions
```

### Step 9 — Commit workflows

```bash
git checkout release/[version]   # or main for project setup
git add .github/workflows/
git add supergraph.yaml
git commit -m "chore(ci): configure github actions workflows and supergraph"
git push origin [branch]
```

### Step 10 — Handoff

```
DevOps CI/CD setup complete

Workflows configured:
  integration-tests.yml  ✅ (feat/**, bugfix/**)
  e2e-tests.yml          ✅ (PR targeting release/**)
  sonarqube.yml          ✅ (feat/**, us/**, bugfix/**, hotfix/**)
  deploy-uat.yml         ✅ (tag: v*-rc*)
  deploy-production.yml  ✅ (tag: v[0-9]*.[0-9]*.[0-9]*)

Rover CLI: ✅
SONAR_TOKEN: ✅
supergraph.yaml: ✅

Tag-to-deploy:
  RC tag (v[version]-rc[n])   → UAT environment
  Stable tag (v[version])     → Production environment
  Mobile                      → Placeholder (Expo pipeline not yet defined)
  Chore release               → No deployment

Next: /pr [version] to begin release setup
```

---

## Scenario B — Release Deployment (Rover Compose)

Triggered when a release branch is ready for deployment verification.
Rover compose is run before tagging to ensure subgraph SDL is valid.

### Step 1 — Check for GraphQL changes

```bash
VERSION="[version]"
grep "graphqlChanges: true" .openspec/requirements/release/${VERSION}/requirements.yaml
```

If no `graphqlChanges: true` found — skip Steps 2 and 3.

### Step 2 — Run Rover supergraph compose

```bash
rover supergraph compose --config ./supergraph.yaml
```

If compose fails:

```
/blocked
Role: devops
Issue: Rover supergraph compose failed
Output: [paste compose error]
Waiting for: /dev to fix subgraph SDL in ./servers/[domain]-subgraph/src/schema/
```

### Step 3 — Update supergraph schema

```bash
rover supergraph compose --config ./supergraph.yaml > ./apollo-router/supergraph.graphql
git add ./apollo-router/supergraph.graphql
git commit -m "chore(router): update supergraph schema for [version]"
git push origin release/[version]
```

---

## Stopping Conditions

Post `/blocked` on release milestone and stop if:

- Terraform or Helm CLI unavailable
- SONAR_TOKEN secret not configured
- Rover supergraph compose fails
- Terraform plan contains destructive changes (wait for developer approval)
- Helm upgrade fails
- Health check fails after deployment
- `supergraph.yaml` missing and cannot be created (no subgraph schema files found)les found)

