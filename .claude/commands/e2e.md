# `/e2e [us-number]` — e2e Test Authoring

Writes Vitest API tests and Cypress browser tests for a specific user story.
Tests target the cluster URL and are expected to fail until all features are
implemented and merged. Triggered before development begins.

---

## Usage

```
/e2e [us-issue-number]    e.g. /e2e 42
```

---

## Prerequisites

```
[ ] CLAUDE.md has been read
[ ] User story issue exists (gh issue view [us-number])
[ ] User story branch exists: us/[us-number]-[short-title]
[ ] ./e2e/ Bun project exists (if not, scaffold it — see Phase 1)
[ ] .openspec/requirements/[release|hotfix]/[version]/requirements.yaml exists
```

---

## Phase 1 — Read Inputs

```bash
# Read user story issue
gh issue view [us-number] --json title,body,labels

# Read OpenSpec for this user story
cat .openspec/requirements/release/[version]/requirements.yaml
# Locate the user story by id matching US-[n] linked in the issue body

# Read all feature sub-issues
gh issue list --milestone "[version]" --label "feature" --json number,title,body
```

Extract from OpenSpec:
- All `e2eTestPlan` scenarios for this user story
- All `features` — their `component`, `input`, `output`, `edgeCases`, `graphqlChanges`
- For frontend/fullstack features — `claudeDesignURL`

---

## Phase 2 — Scaffold ./e2e Project (if not exists)

```bash
if [ ! -f "./e2e/package.json" ]; then
  mkdir -p ./e2e
  cd ./e2e
  bun init -y
  bun add -d vitest @vitest/coverage-v8
  bun add -d cypress
fi
```

Create `./e2e/vitest.config.ts` if missing:
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

Create `./e2e/cypress.config.ts` if missing:
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

Update `./e2e/package.json` scripts if missing:
```json
{
  "scripts": {
    "test:api": "vitest run",
    "test:e2e": "cypress run",
    "test:all": "bun run test:api && bun run test:e2e"
  }
}
```

---

## Phase 3 — Write Vitest API Tests

For each feature with backend or fullstack type, create:
`./e2e/api/[us-short-title]/[feat-short-title].test.ts`

```typescript
import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.CLUSTER_URL ?? 'http://localhost:80'

describe('[Feature title] — API', () => {
  // One test per e2e scenario from the user story e2eTestPlan
  // Plus one test per edge case from the feature spec
  it('[scenario from e2eTestPlan]', async () => {
    const res = await fetch(`${BASE_URL}/[endpoint]`, {
      method: '[METHOD]',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* input from spec */ }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('[expected field]')
  })

  it('returns 4xx when [edge case]', async () => {
    const res = await fetch(`${BASE_URL}/[endpoint]`, {
      method: '[METHOD]',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* invalid input */ }),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })
})
```

Rules:
- One test block per feature minimum
- Cover all `e2eTestPlan` scenarios from the user story
- Cover all `edgeCases` from each feature spec
- Use `CLUSTER_URL` env var — never hardcode URLs
- Do not mock API responses — tests must hit the real cluster

---

## Phase 4 — Write Cypress Browser Tests

For each frontend or fullstack feature, create:
`./e2e/cypress/e2e/[us-short-title]/[feat-short-title].cy.ts`

```typescript
describe('[Feature title] — Browser', () => {
  beforeEach(() => {
    cy.visit('/[route]')
  })

  // One test per acceptance criterion from the user story
  it('[acceptance criterion]', () => {
    // Given
    cy.get('[data-testid="[element]"]').should('be.visible')
    // When
    cy.get('[data-testid="[input]"]').type('[value]')
    cy.get('[data-testid="[submit]"]').click()
    // Then
    cy.get('[data-testid="[result]"]').should('contain', '[expected]')
  })

  // One test per UI state from uiInteractions
  it('shows loading state during [action]', () => {
    cy.get('[data-testid="[trigger]"]').click()
    cy.get('[data-testid="[loader]"]').should('be.visible')
  })

  it('shows error state when [edge case]', () => {
    // simulate error
    cy.get('[data-testid="[error-element]"]').should('be.visible')
  })
})
```

Rules:
- Use `data-testid` attributes only — never CSS classes or text content
- Cover all acceptance criteria from the user story
- Cover all `uiInteractions` states: loading, error, empty, success
- Fetch Claude Design project from `claudeDesignURL` to understand component structure

---

## Phase 5 — Commit to User Story Branch

```bash
git checkout us/[us-number]-[short-title]
git pull origin us/[us-number]-[short-title]
git add ./e2e/
git commit -m "test(e2e): add e2e tests for [user story title]"
git push origin us/[us-number]-[short-title]
```

e2e tests are NOT triggered by CI at this point — they only run when a PR
is opened targeting `release/**`. Failing here is expected and correct.

---

## Phase 6 — Report Complete

```
/e2e complete
User story: #[us-number] [title]
Branch: us/[us-number]-[short-title]

Vitest API tests:
  ./e2e/api/[us-short-title]/[feat-short-title].test.ts  ([n] tests)

Cypress browser tests:
  ./e2e/cypress/e2e/[us-short-title]/[feat-short-title].cy.ts  ([n] tests)

Tests are expected to fail until all features are implemented.

Next step:
  /dev [us-number]   — start development for this user story
```

---

## Stopping Conditions

Post `/blocked` and stop if:
- User story issue does not exist
- User story branch does not exist
- No `e2eTestPlan` scenarios found in OpenSpec for this user story
- A frontend feature has no `claudeDesignURL` — cannot write meaningful browser tests