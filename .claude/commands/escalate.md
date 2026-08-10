# /escalate KAN-{N}

## Purpose
Surface a specific decision to Edward for resolution.

## Triggered By
Edward or any agent role, when a decision meets escalation criteria (see `shared/escalation-to-owner`).

## Pre-checks
None — any role can trigger this when escalation criteria are met.

## Steps
1. Collect all escalation items from current session (`shared/escalation-to-owner`).
2. Produce consolidated escalation document.
3. Pause affected work items in kanban.
4. Present to Edward.
5. After Edward decides: update all affected artifacts.
6. Resume paused work.

## Output
Consolidated escalation document presented to Edward; affected artifacts updated after decision; paused work resumed.

## On Failure
If Edward does not respond and the item is BLOCKING: work stays paused — do not proceed on an assumed decision.

## References
- `.claude/skills/shared/escalation-to-owner/SKILL.md`
- `.claude/skills/pm/kanban-board-management/SKILL.md`
