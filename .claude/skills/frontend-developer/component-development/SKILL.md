# Component Development

## Purpose
Creates React components following module structure, HeroUI conventions, and performance best practices.

## Role
Frontend Developer

## Phase
Development

## Triggered By
New UI element needed (from UI/UX `interaction-specification`).

## Inputs
- `interaction-specification` and `component-requirements` from UI/UX Designer

## Process
UI Framework: HeroUI (React). Feature components: `modules/{feature}/components/`. Shared components: `shared/components/`.

Every component MUST have a Storybook story — no exceptions.

### Performance Rules
- Use `React.memo()` for expensive components (pure, same props = same output)
- Avoid unnecessary re-renders (stable references for callbacks, `useMemo` for computed)
- Lazy load components below the fold: `React.lazy()` + `Suspense`
- Prefer CSS for animations over JS (less re-render pressure)

### Import Rule
NEVER import from another module directly. Cross-module sharing goes through `shared/` only.

### Component Structure
```typescript
// Example: modules/{feature}/components/{Component}.tsx
import { FC } from 'react'
import { Button } from '@heroui/react'

interface {Component}Props {
  // explicit prop types — no any
}

export const {Component}: FC<{Component}Props> = ({ prop1, prop2 }) => {
  // component logic
  return (
    // JSX using HeroUI components
  )
}
```

## Outputs
Implemented component with accompanying Storybook story.

## Quality Gates
- [ ] HeroUI components used (not custom basic HTML where HeroUI exists)
- [ ] Storybook story created for every component
- [ ] No cross-module direct imports
- [ ] Performance: React.memo applied where appropriate

## References
- `.claude/skills/ui-ux-designer/interaction-specification/SKILL.md`
- `.claude/skills/frontend-developer/storybook-component-documentation/SKILL.md`
