# `/dev` — Feature Development

Implements features through sequential task phases, each on its own branch.
Auto-runs /review and /fix after implementation phases.
Opens PR per task phase — developer merges before next phase starts.
Never merges locally.

---

## Usage

```
/dev [us-number]              Trigger all feat development for a user story sequentially
/dev feat [feat-number]       Implement one specific feature through all phases
/dev us [us-number]           Open user story PR (us → release)
/dev bugfix [bug-number]      Fix a bugfix branch and open PR
/dev hotfix [version]         Implement all bugfix branches under a hotfix sequentially
```

---

## Reference Documents

Read before starting any feature implementation:

- `.claude/SOP/testing-standards.md` — unit test patterns (Rstest), QA task test patterns

---

## Shared Rules

- UAT PR (`uat/[us-number]` → `us/[us-number]`) must be merged before any `/dev feat` starts
- Never merge locally — every branch transition goes through a PR
- Never modify test files to make them pass — fix the implementation
- Every task branch is created from `feat/` — never from another task branch
- No direct commits to `feat/` — everything goes through task branch PRs
- Developer merges every PR — Claude Code never merges autonomously
- Phases are strictly sequential — next phase only starts after developer confirms merge
- Commit using conventional commits: `type(scope): description`

---

## Phase Order by Feature Type

| Feature type | Phases in order |
|---|---|
| `backend` | backend → qa → devops |
| `frontend` | frontend → qa → devops |
| `fullstack` | backend → frontend → qa → devops |

DevOps phase is always present for every feature regardless of type.

---

## Branch and Issue Hierarchy

```
feat/[feat-number]-[short-title]          ← created by /pr
├── task/[feat-number]-backend            ← [BACKEND] sub-issue
├── task/[feat-number]-frontend           ← [FRONTEND] sub-issue (fullstack/frontend only)
├── task/[feat-number]-qa                 ← [QA] sub-issue
│   ├── task/[feat-number]-bugfix-1       ← [BUG] sub-issue if tests fail
│   └── task/[feat-number]-bugfix-2       ← if more bugs found
└── task/[feat-number]-devops             ← [DEVOPS] sub-issue
```

---

## `/dev [us-number]` — All Features Under a User Story

### Step 0 — Verify UAT PR is merged

```bash
gh pr list \
  --base us/[us-number]-[short-title] \
  --head uat/[us-number]-[short-title] \
  --state open
```

If UAT PR is still open:

```
/blocked
Command: /dev [us-number]
Issue: UAT PR not yet merged into us/[us-number]-[short-title]
Waiting for: developer to merge QA PR (#[pr-number]) before /dev can begin
```

### Step 1 — List all features

```bash
gh issue view [us-number] --json body
# Extract feature sub-issue numbers from Sub-Issues checklist
```

### Step 2 — Execute sequentially

For each feature sub-issue, call `/dev feat [feat-number]`.
After each feature's final task PR is opened — stop and report:

```
Feature #[feat-number] [title] — all task PRs open.
Please merge all task PRs into feat/[feat-number]-[short-title].
Reply to continue to next feature.
```

Wait for developer confirmation before starting the next feature.

---

## `/dev feat [feat-number]` — One Feature Through All Phases

### Phase 0 — Read inputs and determine phase order

```bash
gh issue view [feat-number] --json title,body
cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
# Locate feature by FEAT-[n] id — read type field
```

Print summary before any work begins:

```
Feature: [FEAT-n] [title]
Type: [backend | frontend | fullstack]
Phase order: [backend →] [frontend →] qa → devops

Functions/methods needed:
  - [function signature] — [what it does]

GraphQL operations (if graphqlChanges: true):
  - [mutation/query name]

UI components (if frontend/fullstack):
  - [component name] — [states: loading, error, empty, success]
```

For frontend/fullstack — fetch Claude Design project from `claudeDesignURL`.

### Phase 1 — BACKEND (backend and fullstack features)

**Create sub-issue:**

```bash
gh issue create \
  --title "[BACKEND] [feature title]" \
  --body "[backend sub-issue template]" \
  --label "backend,release/[version]" \
  --milestone "[version]"
```

Backend sub-issue template:

```markdown
## Backend Implementation
Parent feature: #[feat-number]
Branch: `task/[feat-number]-backend`

## Scope
- gRPC server methods per spec
- Subgraph resolvers per spec
- Rstest unit tests (spec-first)

## Technical Spec
[from OpenSpec: component, input, output, edgeCases]

## GraphQL Changes
[if graphqlChanges: true — SDL changes required]

## Definition of Done
- [ ] gRPC methods implemented
- [ ] Subgraph resolvers implemented
- [ ] Rover compose verified (if graphqlChanges: true)
- [ ] Unit tests written and passing (turbo run test)
- [ ] PR opened into feat/[feat-number]-[short-title]
```

**Create task branch:**

```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
git checkout -b task/[feat-number]-backend
git push -u origin task/[feat-number]-backend
```

**Write Rstest unit tests first (spec-first):**

Read `.claude/SOP/testing-standards.md` for Rstest patterns.

Write tests in `./servers/[domain]/tests/unit/` against function signatures
from the Phase 0 summary. Tests must fail initially — implementation not yet written.

```bash
git commit -m "test(unit): add unit tests for [feature title] backend"
```

**Run tests — expect failure:**

```bash
turbo run test --filter=[domain]
```

**Implement:**

- gRPC server methods per OpenSpec `component`, `input`, `output`
- Handle all `edgeCases` from OpenSpec
- Consistent error shapes for all failure paths
- If `graphqlChanges: true`:

  ```bash
  # Implement SDL in ./servers/[domain]-subgraph/src/schema/
  rover supergraph compose --config ./supergraph.yaml
  ```

**Run tests until passing:**

```bash
turbo run test --filter=[domain]
# Fix implementation (never tests) until all pass
git commit -m "feat(backend): implement [feature title]"
git push origin task/[feat-number]-backend
```

**Open PR:**

```bash
gh pr create \
  --title "[BACKEND] [feature title]" \
  --base feat/[feat-number]-[short-title] \
  --body "[backend PR template]" \
  --draft=false
```

Backend PR template:

```markdown
## Backend Implementation
Linked issue: #[backend-sub-issue-number]
Parent feature: #[feat-number]

## Changes
- [gRPC methods implemented]
- [Subgraph resolvers implemented]

## Test Evidence
- Unit tests: ✅ turbo run test passing
- Rover compose: [✅ verified | N/A]

## GraphQL Changes
[list subgraphs updated or N/A]
```

**Report and stop:**

```
[BACKEND] PR opened: #[pr-number]
Branch: task/[feat-number]-backend → feat/[feat-number]-[short-title]
Unit tests: ✅ passing
Please merge and confirm to continue to [frontend | qa] phase.
```

### Phase 2 — FRONTEND (frontend and fullstack features only)

**Create sub-issue:**

```bash
gh issue create \
  --title "[FRONTEND] [feature title]" \
  --body "[frontend sub-issue template]" \
  --label "frontend,release/[version]" \
  --milestone "[version]"
```

Frontend sub-issue template:

```markdown
## Frontend Implementation
Parent feature: #[feat-number]
Branch: `task/[feat-number]-frontend`

## Scope
- React components per Claude Design URL
- Apollo Client queries/mutations/subscriptions
- All UI states: loading, error, empty, success, default

## Claude Design URL
[claudeDesignURL from OpenSpec]

## UI Interactions
[uiInteractions from OpenSpec]

## Definition of Done
- [ ] Components implemented matching Claude Design
- [ ] Apollo Client wiring complete
- [ ] All UI states implemented
- [ ] data-testid attributes on all interactive and state elements
- [ ] PR opened into feat/[feat-number]-[short-title]
```

**Create task branch:**

```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
git checkout -b task/[feat-number]-frontend
git push -u origin task/[feat-number]-frontend
```

**Implement:**

- Fetch Claude Design project from `claudeDesignURL`
- Component tree from Claude Design is the structural source of truth
- Use design tokens from Claude Design — never hardcode colours, spacing, font sizes
- Wire Apollo Client queries/mutations/subscriptions per OpenSpec
- Implement all UI states: default, loading, error, empty, success
- Add `data-testid` attributes on all interactive and state elements
- Apply responsive behaviour from `responsiveBreakpoints`

```bash
git commit -m "feat(frontend): implement [feature title]"
git push origin task/[feat-number]-frontend
```

**Open PR:**

```bash
gh pr create \
  --title "[FRONTEND] [feature title]" \
  --base feat/[feat-number]-[short-title] \
  --body "[frontend PR template]" \
  --draft=false
```

Frontend PR template:

```markdown
## Frontend Implementation
Linked issue: #[frontend-sub-issue-number]
Parent feature: #[feat-number]

## Changes
- [components implemented]
- [Apollo Client wiring]

## UI States Implemented
- [ ] Default
- [ ] Loading
- [ ] Error
- [ ] Empty
- [ ] Success

## Claude Design
[claudeDesignURL]
```

**Report and stop:**

```
[FRONTEND] PR opened: #[pr-number]
Branch: task/[feat-number]-frontend → feat/[feat-number]-[short-title]
Please merge and confirm to continue to qa phase.
```

### Phase 3 — QA

**Create sub-issue:**

```bash
gh issue create \
  --title "[QA] [feature title]" \
  --body "[qa sub-issue template]" \
  --label "qa,release/[version]" \
  --milestone "[version]"
```

QA sub-issue template:

```markdown
## QA Test Cases
Parent feature: #[feat-number]
Branch: `task/[feat-number]-qa`

## Source
Tests derived by reading actual backend + frontend implementation.
Verifies the implementation works correctly — not business requirements
(those are covered by uat/[us-number] tests).

## Integration Tests (if backend or fullstack)
Location: `./e2e/integration/[us-number]/[feat-number]/`

## e2e Tests (if frontend or fullstack)
Location: `./e2e/cypress/[us-number]/[feat-number]/`

## Definition of Done
- [ ] Tests written from reading actual implementation
- [ ] All tests passing
- [ ] Bug sub-issues created for any failures
- [ ] All bugs fixed and merged
- [ ] PR opened into feat/[feat-number]-[short-title]
```

**Create task branch:**

```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
git checkout -b task/[feat-number]-qa
git push -u origin task/[feat-number]-qa
```

**Read implementation to derive tests:**

For backend/fullstack — read actual resolver and gRPC method code:

```bash
cat ./servers/[domain]/src/[relevant files]
cat ./servers/[domain]-subgraph/src/[relevant files]
```

For frontend/fullstack — read actual component code:

```bash
cat ./[frontend-app]/src/[relevant component files]
```

**Write integration tests (backend and fullstack):**

Create `./e2e/integration/[us-number]/[feat-number]/[feat-short-title].test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.CLUSTER_URL ?? 'http://localhost:80'

// QA integration test — derived from reading actual implementation
// Tests that the implementation works correctly
// Always calls through Apollo Router — never gRPC directly, never mocked

describe('[Feature title] — QA Integration', () => {
  // Tests derived from reading actual resolver implementation
  it('[what the implementation actually does]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `[actual GraphQL operation from implementation]`,
        variables: { /* actual input shape from implementation */ },
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ /* actual output shape from implementation */ })
    expect(body.errors).toBeUndefined()
  })

  // Edge cases found by reading implementation
  it('handles [edge case found in implementation]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `[operation]`,
        variables: { /* edge case input */ },
      }),
    })
    const body = await res.json()
    expect(body.errors).toBeDefined()
  })
})
```

**Write Cypress tests (frontend and fullstack):**

Create `./e2e/cypress/[us-number]/[feat-number]/[feat-short-title].cy.ts`:

```typescript
// QA e2e test — derived from reading actual component implementation
// Tests that the UI flow works correctly given what was built

describe('[Feature title] — QA e2e', () => {
  beforeEach(() => {
    cy.visit('/[actual route from implementation]')
  })

  // Tests derived from reading actual component code
  it('[what the component actually does]', () => {
    cy.get('[data-testid="[actual testid from implementation]"]').should('be.visible')
    cy.get('[data-testid="[actual input testid]"]').type('[value]')
    cy.get('[data-testid="[actual submit testid]"]').click()

    cy.intercept('POST', '/graphql').as('apiCall')
    cy.wait('@apiCall').then((interception) => {
      expect(interception.request.body.query).to.include('[actual operation name]')
    })
    cy.get('[data-testid="[actual result testid]"]').should('be.visible')
  })

  // UI states from actual component implementation
  it('shows loading state', () => { /* ... */ })
  it('handles error state', () => { /* ... */ })
  it('shows empty state', () => { /* ... */ })
})
```

**Commit tests:**

```bash
git add ./e2e/
git commit -m "test(qa): add QA tests for [feature title]"
git push origin task/[feat-number]-qa
```

**Run tests:**

```bash
cd ./e2e

# Run integration tests for this feature
bun run test:integration -- integration/[us-number]/[feat-number]/

# Run Cypress tests for this feature
bun run test:e2e -- --spec "cypress/[us-number]/[feat-number]/**"
```

**If tests pass:**

Run /review on this feature first:

```
Read .claude/commands/review.md
Run /review feat [feat-number]
```

If /review finds issues → run /fix review → re-run tests.
When all clean → open QA PR.

**If tests fail — bug cycle:**

For each failing test:

```bash
gh issue create \
  --title "[BUG] [description of failure]" \
  --body "[bug sub-issue template]" \
  --label "bug,qa,release/[version]" \
  --milestone "[version]"
```

Bug sub-issue template:

```markdown
## Bug Found in QA
Parent QA issue: #[qa-sub-issue-number]
Parent feature: #[feat-number]
Branch: `task/[feat-number]-bugfix-[n]`

## Failing Test
[test name and file]

## Expected
[what the test expects]

## Actual
[what the implementation does]

## Definition of Done
- [ ] Bug fixed on task/[feat-number]-bugfix-[n]
- [ ] Test passing
- [ ] PR merged into feat/[feat-number]-[short-title]
```

Create bugfix branch from `feat/` (not from `task/`):

```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
git checkout -b task/[feat-number]-bugfix-[n]
git push -u origin task/[feat-number]-bugfix-[n]
```

Report all bug issues and branches:

```
QA found [n] failing tests.

Bug sub-issues created:
  #[bug-number] [description] → task/[feat-number]-bugfix-1
  #[bug-number] [description] → task/[feat-number]-bugfix-2

Run /dev bugfix [bug-number] for each bug.
After all bug PRs are merged into feat/, confirm and QA will re-run.
```

After all bugs fixed and merged → re-run tests → repeat cycle until all pass.

**Open QA PR (when all tests pass and /review clean):**

```bash
gh pr create \
  --title "[QA] [feature title]" \
  --base feat/[feat-number]-[short-title] \
  --body "[QA PR template]" \
  --draft=false
```

QA PR template:

```markdown
## QA Test Cases
Linked issue: #[qa-sub-issue-number]
Parent feature: #[feat-number]

## Tests Written From Implementation
Integration: `./e2e/integration/[us-number]/[feat-number]/`
Cypress e2e: `./e2e/cypress/[us-number]/[feat-number]/`

## Test Results
- Integration tests: ✅ all passing
- Cypress e2e: ✅ all passing

## Bugs Found and Fixed
[list bug sub-issues and their fix PRs, or "None"]

## /review
- Spec compliance: ✅
- Code quality: ✅
```

**Report and stop:**

```
[QA] PR opened: #[pr-number]
Branch: task/[feat-number]-qa → feat/[feat-number]-[short-title]
All tests passing ✅
/review clean ✅
Please merge and confirm to continue to devops phase.
```

### Phase 4 — DEVOPS

**Create sub-issue:**

```bash
gh issue create \
  --title "[DEVOPS] [feature title]" \
  --body "[devops sub-issue template]" \
  --label "devops,release/[version]" \
  --milestone "[version]"
```

Ensure `devops` label exists:

```bash
gh label create "devops" --color "5319e7" --description "DevOps configuration"
```

DevOps sub-issue template:

```markdown
## DevOps Configuration
Parent feature: #[feat-number]
Branch: `task/[feat-number]-devops`

## Scope
Helm and Terraform already exist — validate and configure for services
this feature touches. Do NOT create new Helm charts or Terraform modules.

## Services Touched
[from deployment.yaml — services with deploy: true for this release]

## Definition of Done
- [ ] Existing Helm values validated and updated for new config
- [ ] Existing Terraform validated for any new resources
- [ ] docker-compose deployment verified (dry-run)
- [ ] Kubernetes deployment verified (dry-run)
- [ ] PR opened into feat/[feat-number]-[short-title]
```

**Create task branch:**

```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
git checkout -b task/[feat-number]-devops
git push -u origin task/[feat-number]-devops
```

**Read deployment manifest:**

```bash
cat .openspec/requirements/[release|hotfix]/[version]/deployment.yaml
# Identify services with deploy: true that this feature touches
```

**Validate and configure Helm:**

```bash
# For each touched service
helm lint ./helm/[service]/
helm template ./helm/[service]/ --values ./helm/values/[environment].yaml

# Update values files for any new config this feature introduces:
# - New environment variables
# - New ports or endpoints
# - New secrets references
# - Changed resource requirements
```

Edit `./helm/values/[service].yaml` or `./helm/[service]/values.yaml` as needed.

**Validate Terraform:**

```bash
cd terraform/
terraform validate
terraform plan -var-file="environments/staging.tfvars"
# Review plan — flag any unexpected changes to developer
```

Update Terraform variables or configs for any new resources this feature introduces.

**Verify docker-compose:**

```bash
docker-compose config   # validates syntax
docker-compose up --dry-run [service]  # dry-run
```

**Verify Kubernetes:**

```bash
kubectl apply --dry-run=client -f ./k8s/[service]/
# or helm dry-run
helm upgrade --install [service] ./helm/[service]/ \
  --namespace default \
  --values ./helm/values/staging.yaml \
  --dry-run
```

**Commit:**

```bash
git add ./helm/ ./terraform/ ./k8s/
git commit -m "chore(devops): configure [service] for [feature title]"
git push origin task/[feat-number]-devops
```

**Open PR:**

```bash
gh pr create \
  --title "[DEVOPS] [feature title]" \
  --base feat/[feat-number]-[short-title] \
  --body "[devops PR template]" \
  --draft=false
```

DevOps PR template:

```markdown
## DevOps Configuration
Linked issue: #[devops-sub-issue-number]
Parent feature: #[feat-number]

## Services Configured
[list of touched services]

## Changes Made
- [Helm values updated: list changes]
- [Terraform updated: list changes]

## Validation
- Helm lint: ✅
- Helm dry-run: ✅
- Terraform validate: ✅
- Terraform plan: ✅ (no unexpected changes)
- docker-compose dry-run: ✅
- Kubernetes dry-run: ✅
```

**Report complete:**

```
[DEVOPS] PR opened: #[pr-number]
Branch: task/[feat-number]-devops → feat/[feat-number]-[short-title]

All phases complete for FEAT #[feat-number] [title]:
  [BACKEND] PR #[pr-number] ✅
  [FRONTEND] PR #[pr-number] ✅ (if applicable)
  [QA] PR #[pr-number] ✅
  [DEVOPS] PR #[pr-number] ✅

Please merge all remaining task PRs into feat/[feat-number]-[short-title].
When all merged, the feature is complete.
```

---

## `/dev us [us-number]` — Open User Story PR

### Step 1 — Verify all features merged

```bash
gh issue list \
  --milestone "[version]" \
  --label "feature" \
  --state open \
  --json number,title

gh pr list \
  --base us/[us-number]-[short-title] \
  --state open \
  --json number,title,labels
```

If any feature PRs still open → report and stop.

### Step 2 — Write architecture and data flow docs

```bash
git checkout us/[us-number]-[short-title]
git pull origin us/[us-number]-[short-title]
```

Create:

- `./docs/src/content/docs/architecture/[us-short-title].mdx`
- `./docs/src/content/docs/data-flows/[us-short-title].mdx`

```bash
git add ./docs/
git commit -m "docs: add architecture and data flow docs for US #[us-number]"
git push origin us/[us-number]-[short-title]
```

### Step 3 — Open user story PR

```bash
gh pr create \
  --title "[US-[us-number]] [user story title]" \
  --base release/[version] \
  --body "[US PR template]" \
  --draft=false
```

US PR template:

```markdown
## Linked Issue
Closes #[us-number]

## Summary
[What this user story delivers]

## Features Included
- #[feat-number] [FEAT] [title] — all task PRs merged ✅
- #[feat-number] [FEAT] [title] — all task PRs merged ✅

## UAT Tests
- Branch: uat/[us-number]-[short-title] ✅ merged
- Integration: ./e2e/integration/[us-number]/
- e2e Cypress: ./e2e/cypress/[us-number]/
- Full e2e: 🔄 triggers on PR creation (kind cluster)

## QA Tests (per feature)
- ./e2e/integration/[us-number]/[feat-number]/  ✅
- ./e2e/cypress/[us-number]/[feat-number]/  ✅

## Docs
- Business logic: ✅
- API: ✅
- Architecture: ✅
- Data flows: ✅
```

---

## `/dev bugfix [bug-number]` — Fix a Bug Branch

```bash
gh issue view [bug-number] --json title,body

git checkout task/[feat-number]-bugfix-[n]
git pull origin task/[feat-number]-bugfix-[n]

gh run list --branch task/[feat-number]-bugfix-[n] --limit 1
gh run view [run-id] --log-failed
```

Fix the implementation. Commit and push:

```bash
git commit -m "fix([scope]): [what was fixed]"
git push origin task/[feat-number]-bugfix-[n]
```

Watch CI. If passes → open PR:

```bash
gh pr create \
  --title "[BUG-[bug-number]] [bug title]" \
  --base feat/[feat-number]-[short-title] \
  --body "[bug PR template]" \
  --draft=false
```

Bug PR template:

```markdown
## Bug Fix
Linked issue: #[bug-number]
Parent feature: #[feat-number]

## Fix
[What was failing and what was changed]

## Test Evidence
- Failing test now passing: ✅
- CI: ✅ passing
```

---

## `/dev hotfix [version]` — All Bugfix Branches Under a Hotfix

```bash
cat .openspec/requirements/hotfix/[version]/requirements.yaml
```

For each bug in `bugs:` key, run `/dev bugfix [bugfix-number]` sequentially.
Open PR per bugfix branch into hotfix branch. Continue without waiting for merges.

Report:

```
/dev hotfix complete — [version]
Bugfixes:
  #[number] [title] → PR #[pr-number] CI ✅
Please merge each PR into hotfix/[version]-[desc].
When all merged: /dev us [hotfix-issue-number]
```

---

## Stopping Conditions

Post `/blocked` and stop if:

- UAT PR not merged when `/dev [us-number]` or `/dev feat` is called
- Feature sub-issue has no technical spec
- Frontend feature `claudeDesignURL` is null or inaccessible
- Rover supergraph compose fails after SDL implementation
- Unit tests still failing after 3 implementation fix cycles
- QA tests still failing after 3 bug fix cycles
- Terraform plan contains unexpected destructive changes
- Developer has not confirmed merge before next phase is requested
