# /rollback v{X}.{Y}.{Z}

## Purpose
Emergency rollback when production deployment fails.

## Triggered By
Edward (when post-release monitoring detects serious issues).

## Pre-checks
None — this is an emergency response command, invoked directly by Edward.

## Steps
1. Release Manager: `rollback-execution` skill — creates rollback kanban card, documents target version, migration rollback needs, communication plan.
2. DevOps: `rollback-deployment` skill — ArgoCD rollback to `v{X}.{Y}.{Z-1}`, Prisma down migration if needed, smoke tests verify rollback.
3. Release Manager: `release-communication` (incident notification).
4. 15-minute monitoring window: verify system stable.
5. Create root cause bug card for next sprint.

## Output
System rolled back to `v{X}.{Y}.{Z-1}`, verified stable, root cause bug card created.

## On Failure
If rollback itself fails smoke tests or Grafana doesn't return to baseline: escalate to Edward immediately — this is now a critical incident beyond normal rollback scope.

## References
- `.claude/skills/release-manager/rollback-execution/SKILL.md`
- `.claude/skills/devops-engineer/rollback-deployment/SKILL.md`
- `.claude/skills/release-manager/release-communication/SKILL.md`
