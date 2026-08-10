# /risk KAN-{N}

## Purpose
Risk logging for an identified risk associated with a story or sprint.

## Triggered By
Any role, when a risk is identified.

## Pre-checks
None — risks must be logged immediately, not deferred.

## Steps
1. Invoke `shared/risk-logging`.

## Output
Risk kanban card created, risk log committed to OpenSpec.

## On Failure
If the calculated risk score is Critical (7-9): immediately triggers `/escalate` in addition to the standard risk log.

## References
- `.claude/skills/shared/risk-logging/SKILL.md`
- `.claude/commands/escalate.md`
