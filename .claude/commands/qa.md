# `/qa [us-number]` — QA Test Case Creation

Creates integration and e2e test cases for a user story.
Triggered automatically by `/pr` after a user story issue is created.
Can also be triggered manually.

Opens a `[QA]` GitHub issue and a PR into the user story branch.
You must merge the QA PR before `/dev` can start.

---

## Usage

```
/qa [us-number]    Create QA tests for a user story
```

---

## Reference Documents

Read before writing any tests:

- `.claude/SOP/testing-standards.md` — test patterns, rules, and folder structure for all layers

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

If any prerequisite fails — post `/blocked` on the user story issue and stop.

---

## Phase 1 — Read Inputs

```bash
# Read user story issue
gh issue view [us-number] --json title,body,labels,milestone

# Read OpenSpec — locate user story by US-[n] id
cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml

# Read all feature sub-issues linked in the user story
gh issue list --milestone "[version]" --label "feature" --json number,title,body
```

Extract from OpenSpec:

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
    specPattern: 'cypress/e2e/**/*.cy.ts',
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
    "test:all": "bun run test:integration && bun run test:e2e"
  }
}
```

---

## Phase 3 — Create QA GitHub Issue

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
## QA Test Cases — [User Story Title]

Parent issue: #[us-number]
User story branch: `us/[us-number]-[short-title]`

## Integration Tests
Location: `./e2e/integration/[us-short-title]/`

Tests the full request path: Apollo Router → subgraph → gRPC service → response.
One test file per feature with backend or fullstack type.

### Test Coverage
[List each INT-[n]-[n] scenario from OpenSpec]

## e2e Tests (Cypress — headless)
Location: `./e2e/cypress/e2e/[us-short-title]/`

Tests UI flow: user action → API call fires → response handled in UI.
Covers acceptance criteria and UI interaction states.

### Test Coverage
[List each E2E-[n] scenario from OpenSpec]
[List each UI state: loading, error, empty, success]

## OpenSpec Reference
`.openspec/requirements/release/[version]/requirements.yaml` — [US-n]

## Definition of Done
- [ ] Integration tests written covering all INT scenarios
- [ ] Integration tests written covering all edge cases
- [ ] Cypress tests written covering all acceptance criteria
- [ ] Cypress tests written covering all UI states from uiInteractions
- [ ] PR opened into us/[us-number]-[short-title]
- [ ] PR merged before /dev starts
```

Note the QA issue number returned.

---

## Phase 4 — Checkout User Story Branch

```bash
git checkout us/[us-number]-[short-title]
git pull origin us/[us-number]-[short-title]
```

---

## Phase 5 — Write Integration Tests

For each feature with `type: backend` or `type: fullstack`:

Create `./e2e/integration/[us-short-title]/[feat-short-title].test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest'

const BASE_URL = process.env.CLUSTER_URL ?? 'http://localhost:80'

// Integration test: calls Apollo Router → subgraph → gRPC → response
// Tests the full request path end-to-end, no mocking

describe('[Feature title] — Integration', () => {
  // Happy path — one test per INT-[n]-[n] scenario from OpenSpec
  it('[INT-n-n scenario description]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `[GraphQL mutation or query from spec]`,
        variables: { /* input from spec */ },
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ /* expected output from spec */ })
    expect(body.errors).toBeUndefined()
  })

  // Edge cases — one test per edgeCase in feature spec
  it('returns error when [edge case description]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `[GraphQL mutation or query]`,
        variables: { /* invalid/edge case input */ },
      }),
    })
    const body = await res.json()
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions.code).toBe('[expected error code]')
  })
})
```

Rules:

- Always call through Apollo Router (`/graphql` endpoint) — never call gRPC directly
- Never mock network calls or service responses
- Use `CLUSTER_URL` env var — never hardcode URLs
- Cover all `integrationTestPlan` scenarios from OpenSpec
- Cover all `edgeCases` from each feature spec
- Add additional edge case tests beyond the spec if coverage feels insufficient

---

## Phase 6 — Write Cypress e2e Tests

For each feature with `type: frontend` or `type: fullstack`:

Fetch the Claude Design project from `claudeDesignURL` to understand component structure and `data-testid` attributes.

Create `./e2e/cypress/e2e/[us-short-title]/[feat-short-title].cy.ts`:

```typescript
// e2e test: UI flow only
// Scope: user triggers action → API call fires → UI handles response
// NOT testing: visual layout, styling, pixel accuracy

describe('[Feature title] — e2e', () => {
  beforeEach(() => {
    cy.visit('/[route from spec]')
  })

  // One test per acceptance criterion from user story
  it('[acceptance criterion description]', () => {
    // Given — set up state
    cy.get('[data-testid="[element]"]').should('be.visible')

    // When — user triggers action
    cy.get('[data-testid="[input]"]').type('[value]')
    cy.get('[data-testid="[submit]"]').click()

    // Then — verify API was called and response handled
    cy.intercept('POST', '/graphql').as('apiCall')
    cy.wait('@apiCall').then((interception) => {
      expect(interception.request.body.query).to.include('[operation name]')
    })
    cy.get('[data-testid="[result]"]').should('contain', '[expected]')
  })

  // One test per UI interaction state from uiInteractions in spec
  it('shows loading state when API call is in flight', () => {
    cy.intercept('POST', '/graphql', (req) => {
      req.on('response', (res) => { res.setDelay(1000) })
    })
    cy.get('[data-testid="[trigger]"]').click()
    cy.get('[data-testid="[loader]"]').should('be.visible')
  })

  it('handles error response from API', () => {
    cy.intercept('POST', '/graphql', {
      body: { errors: [{ message: '[error]', extensions: { code: '[code]' } }] }
    })
    cy.get('[data-testid="[trigger]"]').click()
    cy.get('[data-testid="[error-banner]"]').should('be.visible')
  })

  it('handles empty state when API returns no data', () => {
    cy.intercept('POST', '/graphql', { body: { data: { [field]: null } } })
    cy.visit('/[route]')
    cy.get('[data-testid="[empty-state]"]').should('be.visible')
  })
})
```

Rules:

- Always use `data-testid` for element selection — never CSS classes or text
- Cypress runs in headless mode — `cypress run --headless`
- Test the flow (action → API → response handling) not the visual appearance
- Use `cy.intercept` to assert API calls were made with correct params
- Use `cy.intercept` with mock responses to test loading/error/empty states
- Cover all `uiInteractions` states from the feature spec
- Cover all `e2eTestPlan` scenarios from the user story spec
- Add additional scenario tests for better coverage where appropriate

---

## Phase 7 — Commit Test Cases

```bash
git add ./e2e/
git commit -m "test(qa): add integration and e2e tests for [user story title]"
git push origin us/[us-number]-[short-title]
```

These tests are expected to fail until `/dev` completes implementation.
Failing at this stage is correct and expected.

---

## Phase 8 — Open QA PR

```bash
gh pr create \
  --title "[QA] [user story title]" \
  --base us/[us-number]-[short-title] \
  --body "[QA PR template below]" \
  --draft=false
```

QA PR template:

```markdown
## QA Test Cases
Linked issue: #[qa-issue-number]
Parent user story: #[us-number]

## Integration Tests Added
- `./e2e/integration/[us-short-title]/[feat-short-title].test.ts`
  - [n] happy path scenarios
  - [n] edge case scenarios

## e2e Tests Added (Cypress — headless)
- `./e2e/cypress/e2e/[us-short-title]/[feat-short-title].cy.ts`
  - [n] acceptance criteria flows
  - [n] UI state tests (loading, error, empty, success)

## Coverage
- OpenSpec scenarios covered: [n]/[n]
- Edge cases covered: [n]/[n]
- Additional tests added: [n]

## Note
Tests are expected to fail until /dev completes implementation.
Please merge this PR before triggering /dev [us-number].
```

---

## Phase 9 — Report Complete

```
/qa complete — US #[us-number] [title]

QA issue: #[qa-issue-number]
QA PR: #[pr-number] (us/[us-number]-[short-title])

Integration tests:
  ./e2e/integration/[us-short-title]/
  [n] scenarios, [n] edge cases

Cypress e2e tests (headless):
  ./e2e/cypress/e2e/[us-short-title]/
  [n] acceptance criteria flows, [n] UI state tests

Additional coverage added: [n] extra test cases

Tests will fail until implementation is complete — this is expected.

⚠️  Please review and merge PR #[pr-number] before running:
  /dev [us-number]
```

---

## Stopping Conditions

Post `/blocked` on the user story issue and stop if:

- User story issue does not exist
- User story branch does not exist
- No `e2eTestPlan` in OpenSpec for this user story
- A frontend/fullstack feature has no `claudeDesignURL`
- `./e2e/` cannot be scaffolded (Bun not available)
