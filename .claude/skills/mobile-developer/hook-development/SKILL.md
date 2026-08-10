# Hook Development

## Purpose
Creates React hooks that abstract Apollo Client calls and local state logic for use by pages and components.

## Role
Mobile Developer

## Phase
Development

## Triggered By
Page or component needs data or state management.

## Inputs
- Generated GraphQL types from `packages/api/`

## Process
Identical to frontend `hook-development`. Platform-agnostic hooks go in `shared/hooks/`.

## Outputs
Implemented hook consumed by pages/components.

## Quality Gates
- [ ] Apollo operations use generated types from packages/api/
- [ ] Hooks are pure (no side effects in hook body — only in useEffect)
- [ ] Return shape is stable (memoised where needed)

## References
- `.claude/skills/frontend-developer/hook-development/SKILL.md`
- `.claude/skills/mobile-developer/usecase-development/SKILL.md`
