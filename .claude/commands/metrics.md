# /metrics

## Purpose
Parallel metrics collection before `/retro`.

## Triggered By
`/retro` command, or manually to refresh current metrics.

## Pre-checks
None.

## Steps
Activate simultaneously:
- QA: `qa-metrics-report`
- Security: `security-metrics-report`
- Release Manager: `release-retrospective-handoff`
- PM: `sprint-review`
- Tech Lead: tech debt + convention violation count

All roles collect simultaneously.

## Output
All metrics documents ready for the `/retro` session.

## On Failure
If any role's metrics collection fails or is incomplete: proceed with the rest, flag the missing section explicitly in the retro report rather than blocking the whole session.

## References
- `.claude/skills/qa-engineer/qa-metrics-report/SKILL.md`
- `.claude/skills/security-engineer/security-metrics-report/SKILL.md`
- `.claude/skills/release-manager/release-retrospective-handoff/SKILL.md`
- `.claude/skills/pm/sprint-review/SKILL.md`
