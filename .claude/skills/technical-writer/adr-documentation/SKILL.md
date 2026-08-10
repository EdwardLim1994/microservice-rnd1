# ADR Documentation

## Purpose
Publishes Architecture Decision Records to the docs site.

## Role
Technical Writer

## Phase
Development (same PR as ADR creation)

## Triggered By
Architect creates an ADR (`architecture-decision-record`).

## Inputs
- ADR from `openspec/changes/{slug}/adr-{N}.md`

## Process
Take ADR from `openspec/changes/{slug}/adr-{N}.md`. Publish to docs site with:
- Navigation in sidebar
- Link to related ADRs
- Status clearly visible (Accepted/Deprecated/Superseded)

Marks superseded ADRs clearly — never deletes historical ADRs.

## Outputs
Location: `apps/docs/src/content/internal/latest/architecture/decisions/`

## Quality Gates
- [ ] ADR added to sidebar navigation
- [ ] Related ADRs cross-linked
- [ ] Status clearly visible
- [ ] Superseded ADRs marked, never deleted

## References
- `.claude/skills/solution-architect/architecture-decision-record/SKILL.md`
- `.claude/skills/technical-writer/architecture-documentation/SKILL.md`
