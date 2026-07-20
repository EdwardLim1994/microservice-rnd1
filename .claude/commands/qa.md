# `/qa [us-number]` — UAT Test Case Creation

Creates UAT-level integration and e2e test cases for a user story.
Tests are derived from OpenSpec `e2eTestPlan`, acceptance criteria, and business logic.
Does NOT read implementation code — tests verify business requirements, not implementation details.

Triggered automatically by `/pr` after each user story issue is created.
Can also be triggered manually.

---

## Usage

```
/qa [us-number]    Create UAT tests for a user story
```

---

## Reference Documents

Read before writing any tests:

- `.claude/SOP/testing-standards.md` — test patterns, rules, folder structure

---

## Prerequisites

```
[ ] CLAUDE.md has been read
[ ] .claude/SOP/testing-standards.md has been read
[ ] User story issue exists: gh issue view [us-number]
[ ] User story branch exists: us/[us-number]-[short-title]
[ ] .openspec/requirements/[release|hotfix]/[version]/requirements.yaml exists
[ ] ./e2e/ Bun project exists (scaffold if missing — see Phase 2)
[ ] GitHub CLI authenticated (gh auth status)
```

---

## Phase 1 — Read Inputs

```bash
gh issue view [us-number] --json title,body,labels,milestone

cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
# Locate user story by US-[n] id

gh issue list --milestone "[version]" --label "feature" --json number,title,body
```

Extract from OpenSpec only — do not read implementation code:

- All `e2eTestPlan` scenarios (Given/When/Then)
- All `acceptanceCriteria`
- All features — `component`, `input`, `output`, `edgeCases`, `type`, `graphqlChanges`
- For frontend/fullstack features — `claudeDesignURL`, `uiInteractions`

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
    include: ['integration/**/*.test.ts'],
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
    specPattern: 'cypress/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
  },
})
```

Update `./e2e/package.json` scripts if missing:

```json
{
  "scripts": {
    "test:integration": "vitest run",
    "test:e2e": "cypress run --headless",
    "test:all": "bun run test:integration && bun run test:e2e",
    "test:uat": "vitest run integration/[us-number]/ && cypress run --headless --spec 'cypress/[us-number]/*.cy.ts'",
    "test:qa": "vitest run integration/[us-number]/[feat-number]/ && cypress run --headless --spec 'cypress/[us-number]/[feat-number]/**'"
  }
}
```

---

## Phase 3 — Create UAT Branch

```bash
git checkout us/[us-number]-[short-title]
git pull origin us/[us-number]-[short-title]
git checkout -b uat/[us-number]-[short-title]
git push -u origin uat/[us-number]-[short-title]
```

All test cases are committed to `uat/[us-number]-[short-title]` — never directly to `us/`.

---

## Phase 4 — Create QA GitHub Issue

```bash
gh issue create \
  --title "[QA] [user story title]" \
  --body "[qa issue template below]" \
  --label "qa,user-story,release/[version]" \
  --milestone "[version]"
```

Ensure `qa` label exists:

```bash
gh label create "qa" --color "0e8a16" --description "QA test cases"
```

QA issue template:

```markdown
## UAT Test Cases — [User Story Title]

Parent issue: #[us-number]
UAT branch: `uat/[us-number]-[short-title]`

## Source
Tests derived from OpenSpec `e2eTestPlan`, acceptance criteria, and business logic.
Does NOT test implementation details — verifies business requirements.

## Integration Tests
Location: `./e2e/integration/[us-number]/`

Full stack: Apollo Router → subgraph → gRPC → response. No mocking.

### Coverage
[List each INT-[n]-[n] scenario from OpenSpec]

## e2e Tests (Cypress — headless)
Location: `./e2e/cypress/[us-number]/`

UI flow: user action → API call → response handling in UI.

### Coverage
[List each E2E-[n] scenario from OpenSpec]
[List each acceptance criterion]
[List each UI state from uiInteractions]

## OpenSpec Reference
`.openspec/requirements/release/[version]/requirements.yaml` — [US-n]

## Definition of Done
- [ ] Integration tests written covering all INT scenarios from OpenSpec
- [ ] Integration tests written covering all edge cases from OpenSpec
- [ ] Cypress tests written covering all acceptance criteria
- [ ] Cypress tests written covering all UI states from uiInteractions
- [ ] PR opened: uat/[us-number] → us/[us-number]
- [ ] PR merged before any /dev feat starts
```

---

## Phase 5 — Write Integration Tests

Create `./e2e/integration/[us-number]/[feat-short-title].test.ts` for each feature
with `type: backend` or `type: fullstack`:

```typescript
import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.CLUSTER_URL ?? 'http://localhost:80'

// UAT integration test — derived from OpenSpec only
// Tests business requirements, not implementation details
// Always calls through Apollo Router — never gRPC directly, never mocked

describe('[Feature title] — UAT Integration', () => {
  // One test per e2eTestPlan scenario from OpenSpec
  it('[E2E-n] [scenario description]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation [OperationName]($input: [InputType]!) {
            [mutationName](input: $input) {
              [fields from OpenSpec output]
            }
          }
        `,
        variables: { /* input from OpenSpec spec */ },
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ /* expected output from OpenSpec */ })
    expect(body.errors).toBeUndefined()
  })

  // One test per edgeCase in OpenSpec
  it('returns error when [edge case from OpenSpec]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `[operation]`,
        variables: { /* invalid input from OpenSpec edgeCases */ },
      }),
    })
    const body = await res.json()
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions.code).toBe('[expected error code from OpenSpec]')
  })
})
```

---

## Phase 6 — Write Cypress e2e Tests

Create `./e2e/cypress/[us-number]/[feat-short-title].cy.ts` for each feature
with `type: frontend` or `type: fullstack`:

```typescript
// UAT e2e test — derived from OpenSpec acceptance criteria and uiInteractions
// Tests user-facing flows and business requirements
// NOT testing implementation details or visual appearance

describe('[Feature title] — UAT e2e', () => {
  beforeEach(() => {
    cy.visit('/[route from OpenSpec]')
  })

  // One test per acceptance criterion from user story
  it('[acceptance criterion from OpenSpec]', () => {
    // Given
    cy.get('[data-testid="[element]"]').should('be.visible')
    // When
    cy.get('[data-testid="[input]"]').type('[value from OpenSpec]')
    cy.get('[data-testid="[submit]"]').click()
    // Then — verify API called and response handled per OpenSpec
    cy.intercept('POST', '/graphql').as('apiCall')
    cy.wait('@apiCall').then((interception) => {
      expect(interception.request.body.query).to.include('[operation from OpenSpec]')
    })
    cy.get('[data-testid="[result]"]').should('contain', '[expected from OpenSpec]')
  })

  // One test per UI state from uiInteractions in OpenSpec
  it('shows loading state during API call', () => {
    cy.intercept('POST', '/graphql', (req) => {
      req.on('response', (res) => { res.setDelay(1000) })
    })
    cy.get('[data-testid="[trigger]"]').click()
    cy.get('[data-testid="[loader]"]').should('be.visible')
  })

  it('handles error response from API', () => {
    cy.intercept('POST', '/graphql', {
      body: { errors: [{ message: '[error]', extensions: { code: '[code]' } }] },
    })
    cy.get('[data-testid="[trigger]"]').click()
    cy.get('[data-testid="[error-banner]"]').should('be.visible')
  })

  it('shows empty state when API returns no data', () => {
    cy.intercept('POST', '/graphql', { body: { data: { [field]: null } } })
    cy.visit('/[route]')
    cy.get('[data-testid="[empty-state]"]').should('be.visible')
  })
})
```

---

## Phase 7 — Commit Test Cases

```bash
git add ./e2e/
git commit -m "test(uat): add UAT integration and e2e tests for US #[us-number]"
git push origin uat/[us-number]-[short-title]
```

Tests will fail until `/dev feat` completes implementation. This is expected.

---

## Phase 8 — Open UAT PR

```bash
gh pr create \
  --title "[QA] [user story title]" \
  --base us/[us-number]-[short-title] \
  --head uat/[us-number]-[short-title] \
  --body "[UAT PR template below]" \
  --draft=false
```

UAT PR template:

```markdown
## UAT Test Cases
Linked issue: #[qa-issue-number]
Parent user story: #[us-number]

## Source
Derived from OpenSpec — tests business requirements, not implementation.

## Integration Tests
`./e2e/integration/[us-number]/`
- [n] e2eTestPlan scenarios
- [n] edge case scenarios

## e2e Tests (Cypress headless)
`./e2e/cypress/[us-number]/`
- [n] acceptance criteria flows
- [n] UI state tests

## Note
Tests will fail until /dev feat completes all phases.
⚠️ Merge this PR before running /dev feat [feat-number].
```

---

## Phase 9 — Report Complete

```
/qa complete — US #[us-number] [title]

QA issue: #[qa-issue-number]
UAT branch: uat/[us-number]-[short-title]
UAT PR: #[pr-number] (uat/[us-number] → us/[us-number])

Integration tests: ./e2e/integration/[us-number]/
  [n] scenarios from OpenSpec e2eTestPlan
  [n] edge cases from OpenSpec

Cypress e2e tests (headless): ./e2e/cypress/[us-number]/
  [n] acceptance criteria flows
  [n] UI state tests from uiInteractions

⚠️  Merge PR #[pr-number] before running:
  /dev feat [feat-number]
```

---

## Stopping Conditions

Post `/blocked` on the user story issue and stop if:

- User story branch does not exist
- No `e2eTestPlan` in OpenSpec for this user story
- A frontend/fullstack feature has no `claudeDesignURL`
- `./e2e/` cannot be scaffolded
