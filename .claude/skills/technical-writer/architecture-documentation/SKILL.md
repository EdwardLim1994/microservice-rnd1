# Architecture Documentation

## Purpose
Adds prose context to draft architecture diagrams before publishing them to the docs site.

## Role
Technical Writer

## Phase
Development (alongside PR — triggered when PR touches `openspec/*/diagrams/`)

## Triggered By
PR touching `openspec/*/diagrams/`.

## Inputs
- Draft MermaidJS diagrams from `openspec/changes/{slug}/diagrams/`

## Process
Take draft MermaidJS diagrams from `openspec/changes/{slug}/diagrams/`. Add prose context:
- Why this architecture was chosen
- Key design decisions
- Trade-offs accepted
- Links to relevant ADRs

Never modifies the diagram itself — prose only.

## Outputs
Location: `apps/docs/src/content/internal/latest/architecture/`

Publishes: updated `system-architecture.md` incorporating the story's changes.

## Quality Gates
- [ ] Diagram content unmodified (prose added only)
- [ ] Design decisions and trade-offs explained
- [ ] Related ADRs linked
- [ ] system-architecture.md updated to reflect the story's changes

## References
- `.claude/skills/solution-architect/system-architecture-diagram/SKILL.md`
- `.claude/skills/solution-architect/story-diagram-design/SKILL.md`
- `.claude/skills/technical-writer/adr-documentation/SKILL.md`
