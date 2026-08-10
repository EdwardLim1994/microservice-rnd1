# Sprint Review

## Purpose
Objective comparison of committed vs delivered, produces metrics for retrospective session.

## Role
Project Manager

## Phase
Retrospective (runs BEFORE `retrospective-facilitation`)

## Triggered By
Production release stable (post `/release-production`).

## Inputs
- Sprint commitment (from sprint-planning)
- Kanban board delivery state

## Process
1. Compare sprint commitment vs delivery:
   - Stories committed: N
   - Stories delivered: N
   - Velocity delta vs previous sprint
2. Count: RC cycles needed, hotfixes, carry-over stories.
3. Calculate: Must Ship delivery rate, Should Ship delivery rate.
4. Review: was sprint goal achieved? (Yes/Partial/No)
5. Pull kanban metrics: card cycle times, blocked durations.
6. Produce sprint-review data for `retrospective-facilitation`.

## Outputs
Sprint review metrics ready for retrospective session.

## Quality Gates
- [ ] All metrics calculated before retrospective begins
- [ ] Velocity trend compared to previous sprint
- [ ] Sprint goal assessment recorded

## References
- `.claude/skills/pm/retrospective-facilitation/SKILL.md`
- `.claude/skills/pm/sprint-planning/SKILL.md`
