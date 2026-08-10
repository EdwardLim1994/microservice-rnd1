# OpenSpec Proposal

## Purpose
Triggers OpenSpec proposal using PRD as input, works with Architect to elaborate design.md, ensures tasks.md is complete.

## Role
Project Manager

## Phase
Planning (Stage 6)

## Triggered By
PRD signed off by all roles.

## Inputs
- Signed-off PRD (`openspec/changes/{slug}/prd.md`)

## Process
1. Run `/opsx:propose` with PRD as input context.
2. Review generated `proposal.md` — verify it matches PRD intent.
3. Work with Architect to elaborate `design.md`:
   - Service interaction diagrams
   - API contract references
   - Data flow descriptions
4. Review generated `tasks.md` — verify completeness:
   - One task per service per feature
   - Each task has area label: backend/frontend/mobile/devops/qa/api/security
   - Dependencies between tasks noted
   - Tasks are sized for one PR (not multi-day without breakdown)
5. Trigger `task-breakdown-review`.

## Outputs
OpenSpec change folder with `proposal.md`, `design.md`, `tasks.md`.

## Quality Gates
- [ ] proposal.md reflects PRD intent accurately
- [ ] design.md elaborated by Architect
- [ ] tasks.md has correct area labels
- [ ] Task dependencies documented
- [ ] task-breakdown-review triggered

## References
- `.claude/skills/pm/prd-writing/SKILL.md`
- `.claude/skills/pm/task-breakdown-review/SKILL.md`
- `opsx:propose` skill
