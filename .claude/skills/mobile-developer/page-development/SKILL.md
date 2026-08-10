# Page Development

## Purpose
Creates route pages/screens that compose components, hooks, and usecases without containing raw API calls or business logic.

## Role
Mobile Developer

## Phase
Development

## Triggered By
New route/screen needed (from UI/UX `user-flow-definition`).

## Inputs
- `user-flow-definition` from UI/UX Designer

## Process
Expo Router (file-based routing) — different from web's file-based router. Pages in `modules/{feature}/pages/` — consumed by Expo Router.

Same rule as frontend: no raw API calls or business logic in pages. Page handles: route params (`useLocalSearchParams`), navigation (`useRouter`).

## Outputs
Implemented page/screen component wired to Expo Router.

## Quality Gates
- [ ] No raw Apollo calls in page components
- [ ] No business logic in page components
- [ ] Loading and error states handled
- [ ] Route auto-registered by Expo Router (not manual)

## References
- `.claude/skills/frontend-developer/page-development/SKILL.md`
- `.claude/skills/mobile-developer/hook-development/SKILL.md`
