# Dependency Mapping

## Purpose
Produces explicit dependency graph for the sprint showing story-to-story, service-to-service, and task-level dependencies.

## Role
Solution Architect

## Phase
Planning (Stage 3)

## Triggered By
`technical-assessment` and `service-boundary-definition` complete.

## Inputs
- Affected services and boundaries for all stories in sprint

## Process
1. Map story-to-story dependencies: which stories must complete before others can start? E.g. "Story KAN-5 (Auth) must complete before KAN-7 (Profile) can begin".
2. Map service-to-service dependencies: which services must be ready before others can integrate?
3. Map task-level sequencing within features: `api/` branch MUST merge first (types needed by `task/` branches); backend tasks must complete before frontend/mobile integration.
4. Map external dependencies: third-party APIs, infrastructure changes, Data Engineer schema work.
5. Produce dependency graph document.

## Outputs
Location: `openspec/changes/{slug}/dependency-graph.md`

```
## Story Dependencies
KAN-{N} depends on: KAN-{N} (reason)

## Service Dependencies
{service-a} must be ready before {service-b} can integrate

## Task Sequencing Within Features
api/{KAN-N} → MUST merge first → unblocks task/ branches
Backend PR merged → unblocks Frontend/Mobile integration

## External Dependencies
{item}: {expected ready date or trigger}
```

Used by: PM `sprint-planning`, PM `kanban-board-management` (daily check).

## Quality Gates
- [ ] All cross-story dependencies mapped
- [ ] Backend-first sequencing explicitly documented
- [ ] api/ branch first-merge rule documented
- [ ] Document committed to OpenSpec

## References
- `.claude/skills/pm/sprint-planning/SKILL.md`
- `.claude/skills/pm/kanban-board-management/SKILL.md`
