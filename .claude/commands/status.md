# /status KAN-{N} (or /status v{X}.{Y}.{Z})

## Purpose
Status report for a story, feature, or full sprint/release.

## Triggered By
Edward requests an update, or any role at a significant milestone.

## Pre-checks
None.

## Steps
1. Invoke PM `kanban-board-management` (reads current state).
2. Invoke `shared/status-reporting`.

## Output
Structured status report with `ON_TRACK` | `AT_RISK` | `BLOCKED` indicator.

## On Failure
If status is `BLOCKED`: immediately trigger `/escalate` in addition to returning the report.

## References
- `.claude/skills/pm/kanban-board-management/SKILL.md`
- `.claude/skills/shared/status-reporting/SKILL.md`
- `.claude/commands/escalate.md`
