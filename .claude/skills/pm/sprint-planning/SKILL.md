# Sprint Planning

## Purpose
Selects which stories/tasks enter the current sprint based on capacity, priority, and dependency order.

## Role
Project Manager

## Phase
Planning (Stage 7)

## Triggered By
`task-prioritisation` completes, Edward approves sprint scope.

## Inputs
- Ranked priority table
- Dependency map (Architect)

## Process

### Capacity Calculation
```
Available parallel workstreams: N (based on agent concurrency)
Average task duration: N days
Sprint duration: N days
Maximum tasks = workstreams × sprint_days / avg_task_days
Must Ship stories fill capacity first
Should Ship fills remaining capacity
Can Hold defers automatically if no capacity
```

### Steps
1. Read ranked priority table from `task-prioritisation`.
2. Calculate sprint capacity using formula above.
3. Select Must Ship stories first (always included regardless of capacity).
4. Fill remaining capacity with Should Ship stories by score.
5. Defer Can Hold automatically.
6. Verify dependency order (Architect's `dependency-mapping`).
7. Verify Data Engineer `api/` tasks are first in each feature.
8. Present sprint plan to Edward for approval.
9. Do not finalise until Edward confirms.

## Outputs
Sprint plan ready for Edward's `/kickoff` approval.

## Quality Gates
- [ ] Must Ship stories always included
- [ ] Capacity not exceeded (unless Edward explicitly approves overcommit)
- [ ] Dependency order respected
- [ ] Edward has approved sprint scope

## References
- `.claude/skills/pm/task-prioritisation/SKILL.md`
- `.claude/skills/pm/milestone-management/SKILL.md`
- `.claude/skills/pm/release-scope-management/SKILL.md`
