# /hotfix v{X}.{Y}.{Z+1}

## Purpose
Hotfix release cycle for a production emergency.

## Triggered By
Edward or Release Manager, in response to a critical production issue.

## Pre-checks
- Confirmed production issue requiring an out-of-band fix (not deferrable to next sprint).

## Steps
1. Create `release/v{X}.{Y}.{Z+1}` from `main` (patch bump).
2. Create `hotfix/{KAN-N}` kanban card (`type: hotfix`, `priority: critical`).
3. Run abbreviated planning (no full 7 stages — only: requirements + AC + security review).
4. Developer implements → `/approve-story` → `/release-staging` → `/release-production`.

## Output
Hotfix released through the full (abbreviated-planning) release cycle, patch-versioned.

## On Failure
If abbreviated planning surfaces a compliance conflict or architectural risk: escalate to Edward before implementation begins.

## References
- `.claude/skills/release-manager/hotfix-release-management/SKILL.md`
- `.claude/commands/approve-story.md`
- `.claude/commands/release-staging.md`
- `.claude/commands/release-production.md`
