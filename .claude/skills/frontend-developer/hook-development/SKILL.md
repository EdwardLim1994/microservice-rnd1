# Hook Development

## Purpose
Creates React hooks that abstract Apollo Client calls and local state logic for use by pages and components.

## Role
Frontend Developer

## Phase
Development

## Triggered By
Page or component needs data or state management.

## Inputs
- Generated GraphQL types from `packages/api/`

## Process
Feature hooks: `modules/{feature}/hooks/`. Shared hooks: `shared/hooks/`.

Hooks abstract:
- Apollo Client queries and mutations
- Local state management (`useState`, `useReducer`)
- Side effects (`useEffect`)
- Computed values (`useMemo`)

### Hook Pattern
```typescript
// modules/{feature}/hooks/use{Feature}.ts
import { useQuery, useMutation } from '@apollo/client'
import { {OPERATION}_QUERY } from '@/generated/{service}/graphql'

export const use{Feature} = () => {
  const { data, loading, error } = useQuery({OPERATION}_QUERY, {
    variables: { ... },
  })

  return {
    data: data?.{field},
    loading,
    error,
  }
}
```

## Outputs
Implemented hook consumed by pages/components.

## Quality Gates
- [ ] Apollo operations use generated types from packages/api/
- [ ] Hooks are pure (no side effects in hook body — only in useEffect)
- [ ] Return shape is stable (memoised where needed)

## References
- `.claude/skills/frontend-developer/apollo-client-implementation/SKILL.md`
- `.claude/skills/frontend-developer/usecase-development/SKILL.md`
