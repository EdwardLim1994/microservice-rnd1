# Issue Triage

## Purpose
Monitors external issue tracker for bug reports and feature requests, triages them into the kanban workflow.

## Role
Project Manager

## Phase
Cross-phase (ongoing)

## Triggered By
New items appear in external issue tracker.

## Inputs
- New items in external issue tracker

## Process
1. Review new items in external issue tracker.
2. Classify: bug report, feature request, or spam/invalid.
3. For bug reports:
   a. Assess severity (Critical/High/Medium/Low)
   b. Create kanban bug card linked to external issue
   c. If Critical/High: notify Tech Lead immediately
   d. Assign to current sprint (if critical) or backlog
4. For feature requests:
   a. Note in kanban as `type: story` (`status: Backlog`)
   b. Leave in external tracker — Edward decides when to action
5. When bug resolved: update external issue "Fixed in PR #N (KAN-{N})".

## Outputs
Kanban cards for actionable bugs, external issues updated on resolution.

## Quality Gates
- [ ] All new external items reviewed within one sprint day
- [ ] Critical bugs escalated immediately
- [ ] Resolved bugs have external issue updated

## References
- `.claude/skills/pm/kanban-board-management/SKILL.md`
- `.claude/skills/shared/escalation-to-owner/SKILL.md`
