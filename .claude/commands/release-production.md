# /release-production v{X}.{Y}.{Z}

## Purpose
Edward's final approval to deploy to Production.

## Triggered By
Edward (after seeing green light from QA + Security).

## Pre-checks
ALL must pass:
- ✓ QA `staging-sign-off`: green (no SLA breaches, stress test acceptable)
- ✓ Security ZAP full scan: no critical/high findings
- ✓ Semi-automated pentest: passed
- ✓ Performance p99 within SLA thresholds for all endpoint types
- ✓ Stress test: breaking point at acceptable user volume
- ✓ Rollback plan: documented AND tested (rollback rehearsed in Staging)
- ✓ Release communication: drafted and ready
- ✓ `go-no-go-assessment` from Release Manager: GO

Shows pre-checks with specific metric values. Blocks if any fail.

## Steps
1. Add production approval comment to release kanban card: "Production release approved by Edward — {timestamp}".
2. ArgoCD manual sync to Production: SAME image tag as Staging — NEVER rebuild.
3. Wait for rolling update complete (all pods healthy).
4. Run smoke tests from `test/smoke/`.
5. Open 30-minute monitoring window: Grafana error rates, response times, Kafka consumer lag.
6. Create final release tag: `v{X}.{Y}.{Z}` on `main`.
7. Mark release branch for 30-day retention then deletion.
8. Update kanban sprint milestone: Done.
9. Release Manager: `release-communication` triggered.
10. Run `/retro v{X}.{Y}.{Z}` automatically.

## Output
- ✅ Release v{X}.{Y}.{Z} deployed to Production
- Monitoring window: 30 minutes (Grafana: error rates, latency, Kafka lag)
- Final tag v{X}.{Y}.{Z} created on main
- Release communication sent
- `/retro v{X}.{Y}.{Z}` triggered automatically

## On Failure
Within the 30-minute monitoring window: if error rate exceeds baseline + 10%, surface to Edward and suggest `/rollback v{X}.{Y}.{Z}`.

## References
- `.claude/skills/release-manager/go-no-go-assessment/SKILL.md`
- `.claude/skills/devops-engineer/production-deployment/SKILL.md`
- `.claude/skills/release-manager/post-release-monitoring/SKILL.md`
- `.claude/commands/rollback.md`
- `.claude/commands/retro.md`
