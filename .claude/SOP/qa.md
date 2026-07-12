# Role SOP — QA (`/qa`)

## Responsibility
Write integration tests before development begins. Write e2e tests in the dedicated `./e2e` project. Conduct code review after development. Signal Dev or Developer at each handoff point.

## e2e Project Structure
e2e tests live in a dedicated Bun project at `./e2e/` — separate from application code.

```
./e2e/
├── package.json                        ← Bun project (Vitest + Cypress)
├── vitest.config.ts                    ← API test runner config
├── cypress.config.ts                   ← Browser test config
├── api/                                ← Vitest API tests hitting cluster URL directly
│   └── [user-story-short-title]/
│       └── [feature-short-title].test.ts
└── cypress/
    ├── e2e/                            ← Cypress browser tests
    │   └── [user-story-short-title]/
    │       └── [feature-short-title].cy.ts
    └── support/
        ├── commands.ts
        └── e2e.ts
```

Both Vitest and Cypress read `CLUSTER_URL` from environment — local kind cluster by default, swappable to remote staging via env var.

## Prerequisites (verify before acting)
```
[ ] CLAUDE.md has been read
[ ] A /handoff qa comment exists on the target user story issue (posted by /pm)
[ ] User story branch and feature branches exist (git ls-remote)
[ ] GitHub CLI is authenticated (gh auth status)
[ ] ./e2e project exists with package.json — if not, scaffold it (see Phase 2)
```

If any prerequisite fails — post a `/blocked` comment on the user story issue and stop.

---

## Phase 1 — Read Inputs

```
1. Read the user story issue (gh issue view [number])
2. Read all feature sub-issues linked in the Sub-Issues checklist
3. Read .openspec/requirements/release/[version]/requirements.yaml for full context
   - For hotfix sessions: read .openspec/requirements/hotfix/[version]/requirements.yaml
4. For features with graphqlChanges: true — read the relevant [domain]-subgraph.api.graphql files
5. For frontend/fullstack features — fetch the Claude Design project URL from claudeDesignURL in the spec
```

---

## Phase 2 — Scaffold ./e2e Project (if not exists)

If `./e2e/package.json` does not exist, initialise the project:

```bash
mkdir -p ./e2e
cd ./e2e

bun init -y

bun add -d vitest @vitest/coverage-v8
bun add -d cypress
```

Create `./e2e/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['api/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
})
```

Create `./e2e/cypress.config.ts`:
```typescript
import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: process.env.CLUSTER_URL ?? 'http://localhost:80',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
  },
})
```

Update `./e2e/package.json` scripts:
```json
{
  "scripts": {
    "test:api": "vitest run",
    "test:e2e": "cypress run",
    "test:all": "bun run test:api && bun run test:e2e"
  }
}
```

Commit scaffold:
```
git checkout us/[number]-[title]
git add ./e2e/
git commit -m "chore(e2e): scaffold e2e project with vitest and cypress"
git push origin us/[number]-[title]
```

---

## Phase 3 — Write Integration Tests (Feature Branches)

Integration tests live inside the respective project (`./servers` for backend, frontend project for UI components). They are written **before** development begins and are expected to fail initially.

For each feature sub-issue:

```bash
git checkout feat/[number]-[title]
git pull origin feat/[number]-[title]
```

### Integration Test Rules

**Backend features** (in `./servers/tests/integration/`):
- Test each endpoint with valid input, invalid input, and boundary conditions
- Test authentication and authorisation where applicable
- Cover all edge cases listed in the sub-issue
- Do not spin up a cluster — use a local server instance or in-process test server

**Frontend features** (in `./[frontend-project]/tests/integration/`):
- Fetch the Claude Design project from the URL in the sub-issue
- Write tests for every UI state: default, loading, error, empty, success
- Write tests for every interaction listed in the sub-issue interaction notes
- Do not hardcode expected values that depend on design tokens — test behaviour, not pixel values

### Commit and push
```bash
git add tests/integration/
git commit -m "test(integration): add integration tests for [feature title]"
git push origin feat/[number]-[title]
```

Confirm GitHub Actions integration test workflow triggers and tests fail as expected.

### Handoff to Dev
Post the following comment on each feature sub-issue:
```
/handoff dev
Feature branch: feat/[number]-[title]
Sub-issue: #[number]
Tests written:
- Integration: tests/integration/[feature-short-title].test.ts
Status: Tests failing as expected (no implementation yet). Ready for development.
```

Repeat Phase 3 for every feature sub-issue before any development begins.

---

## Phase 4 — Write e2e Tests (./e2e project, user story branch)

e2e tests are written on the user story branch after all integration tests are written. They test the full stack against a running cluster URL. They are expected to fail until all features are implemented and merged.

```bash
git checkout us/[number]-[title]
git pull origin us/[number]-[title]
```

### Vitest API Tests

For each feature's API endpoints under this user story, create:
`./e2e/api/[user-story-short-title]/[feature-short-title].test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = process.env.CLUSTER_URL ?? 'http://localhost:80'

describe('[Feature title] — API', () => {
  // Happy path
  it('[scenario from e2e test plan]', async () => {
    const res = await fetch(`${BASE_URL}/[endpoint]`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* input from sub-issue spec */ }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('[expected field]')
  })

  // Edge case
  it('returns 4xx when [edge case from sub-issue]', async () => {
    const res = await fetch(`${BASE_URL}/[endpoint]`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* invalid input */ }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
```

### Cypress Browser Tests

For each user-facing flow under this user story, create:
`./e2e/cypress/e2e/[user-story-short-title]/[feature-short-title].cy.ts`

```typescript
describe('[Feature title] — Browser', () => {
  beforeEach(() => {
    cy.visit('/[route]')
  })

  it('[scenario from e2e test plan]', () => {
    // Given
    cy.get('[data-testid="[element]"]').should('be.visible')
    // When
    cy.get('[data-testid="[input]"]').type('[value]')
    cy.get('[data-testid="[submit]"]').click()
    // Then
    cy.get('[data-testid="[result]"]').should('contain', '[expected]')
  })
})
```

### e2e Test Rules
- One test per scenario in the e2e test plan in the user story issue minimum
- Cover all acceptance criteria — each criterion must have at least one passing test
- Do not mock API responses — hit the real cluster URL
- Use `data-testid` attributes for element selection — never CSS classes or text content
- Cover at least one failure/edge case per user-facing flow
- Vitest API tests and Cypress tests must share the same `CLUSTER_URL` env var

### Commit and push
```bash
git add ./e2e/
git commit -m "test(e2e): add e2e tests for [user story title]"
git push origin us/[number]-[title]
```

e2e tests are NOT run by GitHub Actions at this stage — they will be triggered when the user story PR (us → release) is opened.

---

## Phase 5 — Code Review

When Dev posts a `/handoff merge` comment on a feature PR, conduct code review before the developer merges:

### Code Review Checklist
```
[ ] Implementation matches the technical spec in the sub-issue exactly
[ ] All edge cases from the sub-issue are handled
[ ] No hardcoded secrets, credentials, or environment-specific values
[ ] No console.log, debug statements, or commented-out code left in
[ ] Error handling is present and meaningful for all failure paths
[ ] Naming (variables, functions, components) is consistent with the existing codebase
[ ] No dead code or unused imports introduced
[ ] Frontend: no hardcoded design token values (colours, spacing, font sizes)
[ ] Frontend: all UI states implemented (loading, error, empty, success)
[ ] Test coverage is adequate — tests are not trivially passing
[ ] SonarQube Quality Gate: PASSED
```

If all items pass — approve the PR with comment:
```
QA review: ✅ APPROVED
All checklist items passed. Ready for merge.
```

If any item fails — request changes with comment:
```
QA review: ❌ CHANGES REQUESTED
[List each failing item with specific line references]
```

Do not approve until all items pass. Dev must fix and re-request review.

---

## Phase 6 — Post All-Feature-Merge Notification

QA does not monitor e2e after individual feature merges. e2e is only triggered when the user story PR is opened.

Once the developer has merged all feature PRs, post on the user story issue:
```
/handoff dev
All features merged into us/[number]-[title]
e2e tests written: ./e2e/api/[us-title]/ and ./e2e/cypress/e2e/[us-title]/
Status: Ready for Dev to open user story PR. e2e will trigger on PR creation.
```

---

## Stopping Conditions

Post a `/blocked` comment and stop if:
- No `/handoff qa` comment exists on the user story issue
- User story or feature branches do not exist
- The user story issue has no acceptance criteria to write e2e tests against
- A frontend sub-issue has no Claude Design URL and no interaction notes
- GitHub Actions workflows do not exist (notify PM to check DevOps setup)
- Integration test failures persist after 3 Dev fix cycles — escalate to developer