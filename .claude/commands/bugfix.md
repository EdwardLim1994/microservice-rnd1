# /bugfix KAN-{N}

## Purpose
Bug fix workflow for a bug found during UAT or Staging.

## Triggered By
Bug kanban card created (`bug-feature`, `bug-story`, or `bug-release`).

## Pre-checks
- Bug card KAN-{N} exists with `area` and bug-type label.

## Steps
1. Read bug card to determine area and parent branch.
2. Create `bugfix/` branch from the appropriate parent:
   - `bug-feature` → from `feat/{KAN-N}`
   - `bug-story` → from `us/{KAN-N}`
   - `bug-release` → from `release/v{X}.{Y}.{Z}`
3. Activate the appropriate developer subagent based on the `area` label.
4. Invoke `tdd-workflow` → implementation → PR raised.

## Output
Bug fixed on the correctly-scoped bugfix branch, PR raised, kanban card updated.

## On Failure
If the bug's parent branch no longer exists (already merged/deleted): escalate to Tech Lead to determine correct rebasing target.

## References
- `.claude/skills/qa-engineer/bug-severity-triage/SKILL.md`
- `.claude/skills/backend-developer/tdd-workflow/SKILL.md`
