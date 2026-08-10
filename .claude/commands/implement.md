# /implement KAN-{N}

## Purpose
Developer picks up a specific task card and implements it.

## Triggered By
Developer subagent, once a task card is unblocked and assigned.

## Pre-checks
- Task card KAN-{N} exists and has an `area` label.
- If area requires generated types (backend/frontend/mobile/api): confirm `api-type-generation` complete for this feature.

## Steps
1. Read task card's `area` label to determine which developer subagent handles it:
   - `area: backend` → Backend Developer subagent
   - `area: frontend` → Frontend Developer subagent
   - `area: mobile` → Mobile Developer subagent
   - `area: api` → Data Engineer subagent
   - `area: qa` → QA Engineer subagent
   - `area: security` → Security Engineer subagent
   - `area: devops` → DevOps Engineer subagent
2. Invoke `tdd-workflow` (backend) or the equivalent workflow for the assigned role.

## Output
Code committed to the task branch, PR raised, kanban card updated.

## On Failure
If generated types are not yet available for a backend/frontend/mobile task: block and wait for Data Engineer's `api-type-generation` signal.

## References
- `.claude/skills/backend-developer/tdd-workflow/SKILL.md`
- `.claude/skills/data-engineer/api-type-generation/SKILL.md`
