# Component Development

## Purpose
Creates React Native components following module structure, HeroUI Native conventions, and performance best practices.

## Role
Mobile Developer

## Phase
Development

## Triggered By
New UI element needed (from UI/UX `interaction-specification`).

## Inputs
- `interaction-specification` and `component-requirements` from UI/UX Designer

## Process
UI Framework: HeroUI React Native (not HeroUI React — different package). Feature components: `modules/{feature}/components/`. Shared components: `shared/components/`.

Every component MUST have a Storybook story (Storybook for React Native).

Same import rule as frontend: never cross-module direct imports.

## Outputs
Implemented component with accompanying Storybook story.

## Quality Gates
- [ ] HeroUI React Native components used where available
- [ ] Storybook story created for every component
- [ ] No cross-module direct imports
- [ ] Performance optimisations applied where appropriate

## References
- `.claude/skills/frontend-developer/component-development/SKILL.md`
- `.claude/skills/mobile-developer/storybook-component-documentation/SKILL.md`
