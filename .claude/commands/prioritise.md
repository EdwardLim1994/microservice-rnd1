# /prioritise

## Purpose
Priority scoring session across the current sprint backlog.

## Triggered By
PM, during Stage 6 of planning, or on demand to re-rank the backlog.

## Pre-checks
- At least one story/epic pending prioritisation exists.

## Steps
1. Invoke PM `task-prioritisation` + `shared/priority-scoring-model`.
2. Each role scores their dimension (PO: Business Value + User Impact; Security: Security Risk; Architect: Dependency Blocking + Technical Complexity; QA: Testability Risk).
3. PM produces ranked priority table.

## Output
Priority table committed to `openspec/changes/sprint-{N}-priority/priority-table.md`.

## On Failure
If any role has not submitted their dimension score: block table production and request missing scores.

## References
- `.claude/skills/pm/task-prioritisation/SKILL.md`
- `.claude/skills/shared/priority-scoring-model/SKILL.md`
