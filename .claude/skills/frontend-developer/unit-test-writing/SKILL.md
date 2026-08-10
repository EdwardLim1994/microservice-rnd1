# Unit Test Writing

## Purpose
Writes unit tests for hooks and usecases following TDD workflow.

## Role
Frontend Developer

## Phase
Development (write before implementation)

## Triggered By
tdd-workflow equivalent for frontend — task picked up.

## Inputs
- Planned hooks/usecases for the task

## Process
Tools: Vitest + React Testing Library (RTL). MSW (Mock Service Worker): for mocking Apollo Client responses.

### Test Scope
- Hooks: test state transitions and returned values
- UseCases: test business logic and Apollo operation calls
- Components: test via Storybook interaction tests (not here)

### Test Pattern (hook)
```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { MockedProvider } from '@apollo/client/testing'

const mocks = [{ request: { query: OPERATION }, result: { data: mockData } }]

it('should return data when query succeeds', async () => {
  const { result } = renderHook(() => use{Feature}(), {
    wrapper: ({ children }) => <MockedProvider mocks={mocks}>{children}</MockedProvider>,
  })
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.data).toEqual(expectedData)
})
```

## Outputs
Passing unit test suite for hooks and usecases.

## Quality Gates
- [ ] Tests written before implementation (TDD)
- [ ] Apollo operations mocked with MockedProvider or MSW
- [ ] Error states tested (not just happy path)
- [ ] Coverage ≥ 80% for new hooks and usecases

## References
- `.claude/skills/frontend-developer/hook-development/SKILL.md`
- `.claude/skills/frontend-developer/usecase-development/SKILL.md`
- `.claude/skills/frontend-developer/storybook-component-documentation/SKILL.md`
