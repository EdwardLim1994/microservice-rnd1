# Testing Standards

Reference document for all test layers in this project.
Consumed by `/qa`, `/dev`, `/fix`, and `/review` commands.
Not a command file — does not execute anything directly.

---

## Test Layer Overview

| Layer | Framework | Scope | Lives in | Created by | Runs via |
|---|---|---|---|---|---|
| Unit | Rstest | Individual functions/methods in isolation | `./servers/[domain]/tests/unit/` | `/dev` | `turbo run test` |
| Integration | Vitest | Apollo Router → subgraph → gRPC → response (no mocking) | `./e2e/integration/[us-title]/` | `/qa` | `bun run test:integration` in `./e2e/` |
| e2e (browser) | Cypress (headless) | UI flow: action → API call → response handling in UI | `./e2e/cypress/e2e/[us-title]/` | `/qa` | `bun run test:e2e` in `./e2e/` |

---

## ./e2e/ Project Structure

```
./e2e/
├── package.json
├── vitest.config.ts           ← integration test config
├── cypress.config.ts          ← browser e2e config (headless)
├── integration/               ← Vitest integration tests
│   └── [us-short-title]/
│       └── [feat-short-title].test.ts
└── cypress/
    ├── e2e/                   ← Cypress browser tests
    │   └── [us-short-title]/
    │       └── [feat-short-title].cy.ts
    └── support/
        ├── commands.ts
        └── e2e.ts
```

### package.json scripts

```json
{
  "scripts": {
    "test:integration": "vitest run",
    "test:e2e": "cypress run --headless",
    "test:all": "bun run test:integration && bun run test:e2e"
  }
}
```

### vitest.config.ts

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

### cypress.config.ts

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

Both Vitest and Cypress read `CLUSTER_URL` from environment.
Local kind cluster by default — swappable to remote staging via env var.

---

## Unit Tests (Rstest)

**Lives in:** `./servers/[domain]/tests/unit/`
**Run via:** `turbo run test` from monorepo root, or `turbo run test --filter=[domain]` for a single service
**Created by:** `/dev` — written before implementation (spec-first)

### When to write

`/dev` writes unit tests in Phase 3, before any implementation exists.
Tests are written against function signatures listed in Phase 1 requirements summary.
Tests are expected to fail initially — implementation comes after.

### Rstest pattern

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    // Parameterised test — one case per spec scenario
    #[rstest]
    #[case([valid input], [expected output])]
    #[case([edge case input], [expected error])]
    fn test_[function_name](#[case] input: [Type], #[case] expected: [Type]) {
        let sut = [Component]::new();
        let result = sut.[function_name](input);
        assert_eq!(result, expected);
    }

    // Additional coverage beyond the spec
    #[test]
    fn test_[function_name]_[additional_scenario]() {
        // boundary conditions, less obvious paths
    }
}
```

### Rules

- At least one test per function signature from the Phase 1 requirements summary
- Cover all `edgeCases` from the OpenSpec feature spec
- `/dev` is free to add more tests beyond the spec for better coverage
- Never modify tests to make them pass — fix the implementation
- Frontend unit tests use Vitest + React Testing Library (see frontend pattern below)

### Frontend unit test pattern (Vitest + RTL)

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

describe('[ComponentName]', () => {
  it('[behaviour from spec]', () => {
    render(<[ComponentName] [props] />)
    fireEvent.click(screen.getByTestId('[data-testid]'))
    expect(screen.getByTestId('[result]')).toBeInTheDocument()
  })

  it('handles [additional scenario]', () => {
    // boundary conditions
  })
})
```

---

## Integration Tests (Vitest)

**Lives in:** `./e2e/integration/[us-short-title]/[feat-short-title].test.ts`
**Run via:** `bun run test:integration` inside `./e2e/`
**Created by:** `/qa` — written on user story branch before `/dev` starts

### Scope

Full request path with no mocking:

```
Test → Apollo Router (/graphql) → subgraph resolver → gRPC service → response
```

Never call gRPC directly. Never mock network calls or service responses.
Tests verify the entire stack works together.

### Pattern

```typescript
import { describe, it, expect } from 'vitest'

const BASE_URL = process.env.CLUSTER_URL ?? 'http://localhost:80'

describe('[Feature title] — Integration', () => {
  // Happy path — one test per INT-[n]-[n] scenario from OpenSpec
  it('[INT-n-n] [scenario description]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation [OperationName]($input: [InputType]!) {
            [mutationName](input: $input) {
              [fields]
            }
          }
        `,
        variables: { /* input from spec */ },
      }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toMatchObject({ /* expected output from spec */ })
    expect(body.errors).toBeUndefined()
  })

  // Edge cases — one test per edgeCase in feature spec
  it('returns GraphQL error when [edge case]', async () => {
    const res = await fetch(`${BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `[operation]`,
        variables: { /* invalid input */ },
      }),
    })
    const body = await res.json()
    expect(body.errors).toBeDefined()
    expect(body.errors[0].extensions.code).toBe('[expected error code]')
  })
})
```

### Rules

- Always call through Apollo Router at `/graphql` — never call gRPC directly
- No mocking of any kind — tests hit the real running cluster
- Use `CLUSTER_URL` env var — never hardcode URLs
- Cover all `integrationTestPlan` scenarios from OpenSpec
- Cover all `edgeCases` from each feature spec
- `/qa` is free to add additional edge case tests for better coverage
- Tests run against the kind cluster in CI (e2e-tests.yml workflow)

---

## e2e Tests — Cypress (headless)

**Lives in:** `./e2e/cypress/e2e/[us-short-title]/[feat-short-title].cy.ts`
**Run via:** `bun run test:e2e` inside `./e2e/` — always headless
**Created by:** `/qa` — written on user story branch before `/dev` starts

### Scope

UI flow testing only:

```
User action → API call fires → Response handling in UI
```

Not for: visual layout testing, pixel accuracy, CSS validation, full page screenshots.

### Pattern

```typescript
describe('[Feature title] — e2e', () => {
  beforeEach(() => {
    cy.visit('/[route from spec]')
  })

  // One test per acceptance criterion from user story
  it('[acceptance criterion description]', () => {
    // Given
    cy.get('[data-testid="[element]"]').should('be.visible')

    // When — user triggers action
    cy.get('[data-testid="[input]"]').type('[value]')
    cy.get('[data-testid="[submit]"]').click()

    // Then — verify API was called and response handled correctly
    cy.intercept('POST', '/graphql').as('apiCall')
    cy.wait('@apiCall').then((interception) => {
      expect(interception.request.body.query).to.include('[operation name]')
    })
    cy.get('[data-testid="[result]"]').should('contain', '[expected]')
  })

  // Loading state
  it('shows loading state while API call is in flight', () => {
    cy.intercept('POST', '/graphql', (req) => {
      req.on('response', (res) => { res.setDelay(1000) })
    })
    cy.get('[data-testid="[trigger]"]').click()
    cy.get('[data-testid="[loader]"]').should('be.visible')
  })

  // Error state
  it('handles error response from API', () => {
    cy.intercept('POST', '/graphql', {
      body: { errors: [{ message: '[error]', extensions: { code: '[code]' } }] },
    })
    cy.get('[data-testid="[trigger]"]').click()
    cy.get('[data-testid="[error-banner]"]').should('be.visible')
  })

  // Empty state
  it('shows empty state when API returns no data', () => {
    cy.intercept('POST', '/graphql', { body: { data: { [field]: null } } })
    cy.visit('/[route]')
    cy.get('[data-testid="[empty-state]"]').should('be.visible')
  })

  // Success state
  it('shows success state after API call completes', () => {
    cy.get('[data-testid="[trigger]"]').click()
    cy.intercept('POST', '/graphql').as('apiCall')
    cy.wait('@apiCall')
    cy.get('[data-testid="[success-indicator]"]').should('be.visible')
  })
})
```

### Rules

- Always run headless: `cypress run --headless`
- Use `data-testid` for all element selection — never CSS classes or text content
- Test the flow (action → API → response handling) not visual appearance
- Use `cy.intercept` to assert API calls were made with correct parameters
- Use `cy.intercept` with mock responses to test loading/error/empty states
- Cover all `e2eTestPlan` scenarios from the user story OpenSpec
- Cover all `uiInteractions` states from each frontend/fullstack feature spec
- Cover all acceptance criteria — at least one test per criterion
- `/qa` is free to add additional scenario tests for better coverage
- `screenshotOnRunFailure: true` — screenshots saved on failure for CI artifact

---

## CI Triggers per Test Layer

| Test layer | Triggered when | Workflow |
|---|---|---|
| Unit (Rstest) | `turbo run test` locally in `/dev` | Not a separate CI workflow — part of feature development loop |
| Integration (Vitest) | Push to `feat/**`, `bugfix/**` | `integration-tests.yml` |
| e2e (Cypress) | PR targeting `release/**`, or `workflow_dispatch` | `e2e-tests.yml` |
| SonarQube | Push to `feat/**`, `us/**`, `bugfix/**`, `hotfix/**` | `sonarqube.yml` |

---

## Test Failure Handling

| Failure | Where | Action |
|---|---|---|
| Unit tests fail during `/dev` | Local (`turbo run test`) | `/dev` fixes implementation, re-runs |
| Integration tests fail in CI | `feat/**` push | `/dev` auto-calls `/fix branch` |
| SonarQube fails in CI | Any push | `/dev` auto-calls `/fix branch` |
| e2e fails on user story PR | `us/**` PR → `release/**` | CI posts comment → `/pr` creates bugfix issue + branch from `us/` → `/fix` |
| e2e fails during `/review release` | `workflow_dispatch` on `release/**` | `/review` calls `/fix branch release/[version]` |

---

## Scaffold Checklist (first time on a project)

```bash
# Verify ./e2e/ project exists
ls ./e2e/package.json

# If not — /qa scaffolds it automatically on first run
# Or manually:
mkdir -p ./e2e
cd ./e2e
bun init -y
bun add -d vitest @vitest/coverage-v8 cypress

# Verify turbo.json includes test pipeline
cat turbo.json | grep '"test"'

# Verify each ./servers/[domain]/ has Rstest configured
# Check Cargo.toml for [dev-dependencies] rstest
```
