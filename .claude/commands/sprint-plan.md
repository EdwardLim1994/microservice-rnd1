# /sprint-plan v{X}.{Y}.{Z}

## Purpose
Sprint planning for the specified version.

## Triggered By
PM, after prioritisation is complete.

## Pre-checks
- Ranked priority table exists for the target sprint.

## Steps
1. Invoke PM `sprint-planning` + `milestone-management`.
2. Produce sprint plan for Edward's review.
3. Require Edward's confirmation before finalising.

## Output
Sprint plan (Must Ship / Should Ship / Can Hold selection, capacity-checked, dependency-ordered) awaiting Edward's approval via `/kickoff`.

## On Failure
If capacity is exceeded without Edward's explicit override, or dependency order cannot be satisfied: block finalisation and surface the conflict.

## References
- `.claude/skills/pm/sprint-planning/SKILL.md`
- `.claude/skills/pm/milestone-management/SKILL.md`
- `.claude/commands/kickoff.md`
