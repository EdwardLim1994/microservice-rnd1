# Module Scaffolding

## Purpose
Scaffolds feature modules and their internal components for the mobile app.

## Role
Mobile Developer

## Phase
Development

## Triggered By
New feature/module needed within an existing mobile app.

## Inputs
- Feature/module requirement from the task

## Process
Same as frontend `module-scaffolding`. Mobile generator in development — mirror frontend structure until available. Module structure identical to frontend: `pages/`, `components/`, `hooks/`, `usecases/`.

```
{app}/src/modules/{feature}/
├── index.ts
├── pages/
├── components/
├── hooks/
└── usecases/
```

Cross-module sharing goes through `shared/` only — same import rule as frontend.

## Outputs
Scaffolded module structure ready for implementation.

## Quality Gates
- [ ] Structure mirrors frontend module-scaffolding pattern
- [ ] No cross-module direct imports
- [ ] Index.ts barrel export created

## References
- `.claude/skills/frontend-developer/module-scaffolding/SKILL.md`
- `.claude/skills/mobile-developer/mobile-app-scaffolding/SKILL.md`
