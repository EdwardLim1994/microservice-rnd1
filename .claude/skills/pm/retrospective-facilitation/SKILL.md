# Retrospective Facilitation

## Purpose
Facilitates the 6-stage retrospective session using sprint-review data as the foundation.

## Role
Project Manager

## Phase
Retrospective

## Triggered By
`/retro` command, `sprint-review` complete.

## Inputs
- Sprint review metrics
- Per-role metrics reports

## Process

### Stage 1 — Metrics Presentation (~15 min)
Each role presents their metrics report. All others listen.
- QA: `qa-metrics-report`
- Security: `security-metrics-report`
- Release Manager: `release-retrospective-handoff`
- PM: `sprint-review`
- Tech Lead: tech debt + convention violation metrics

### Stage 2 — Pattern Identification (~20 min)
What patterns emerge across all reports? Connect metrics across roles (e.g. QA bug count vs SonarQube findings).

### Stage 3 — Root Cause Discussion (~20 min)
For each significant pattern: why did it occur? No blame — systemic analysis only.

### Stage 4 — Improvement Actions (~15 min)
Each root cause → concrete improvement action with:
- Problem, Root Cause, Action, Owner, Measure, Priority
- Type: SKILL (update `.claude/skills/`) | CONVENTION (update CLAUDE.md) | PIPELINE (update CI/CD) | PROCESS (update command/stage)

### Stage 5 — Backlog Creation (~5 min)
PO: `retrospective-conclusion` (creates kanban backlog cards).

### Stage 6 — Next Sprint Preview (~10 min, optional)
PM previews next sprint scope based on Must Ship improvement items. Sets next `/start` trigger point.

### Report Location
`openspec/changes/retro-v{X}.{Y}.{Z}/retro.md` — FIXED 10-section format (see `openspec/retro-template.md`).

### For Incidents (`/retro --incident`)
Add Stage 2a — Incident Analysis between Stage 2 and 3:
- What failed in production? Which gate should have caught it?
- Why did it pass UAT but fail production?
- Additional output: `openspec/changes/retro-v{X}.{Y}.{Z}/incident.md`

## Outputs
Retro report at `openspec/changes/retro-v{X}.{Y}.{Z}/retro.md`, improvement actions, closed sprint milestone.

## Quality Gates
- [ ] All 6 stages completed
- [ ] Fixed 10-section report format used
- [ ] All improvement actions have owners and measures
- [ ] Sprint milestone closed after retro

## References
- `.claude/skills/pm/sprint-review/SKILL.md`
- `.claude/skills/po/retrospective-conclusion/SKILL.md`
- `.claude/skills/pm/milestone-management/SKILL.md`
- `openspec/retro-template.md`
