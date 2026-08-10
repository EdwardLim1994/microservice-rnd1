# Milestone Management

## Purpose
Creates and manages sprint milestones in kanban, handles carry-over between sprints.

## Role
Project Manager

## Phase
Planning + Retrospective

## Triggered By
Sprint planning approval, retrospective completion.

## Inputs
- Approved sprint plan
- Incomplete tasks at sprint end (for carry-over)

## Process

### Sprint Start
1. Create sprint milestone in kanban:
   - Name: `v{X}.{Y}.{Z}`
   - Goal: `{sprint goal text}`
   - Start date: `{date}`
   - End date: `{date}`
2. Assign all sprint task cards to milestone.
3. Link release branch to milestone.

### Sprint End
1. Identify incomplete tasks at sprint end.
2. Move carry-over tasks to next sprint milestone.
3. Close current sprint milestone after retro complete.
4. Branch retention: mark release branch for 30-day retention then delete.

## Outputs
Sprint milestone created or closed with carry-over handled.

## Quality Gates
- [ ] Milestone has goal, start, and end dates
- [ ] All sprint tasks assigned to milestone
- [ ] Carry-over tasks moved to next milestone
- [ ] Old milestone closed after retro

## References
- `.claude/skills/pm/sprint-planning/SKILL.md`
- `.claude/skills/pm/retrospective-facilitation/SKILL.md`
