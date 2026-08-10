# /release-staging v{X}.{Y}.{Z}

## Purpose
Edward's approval to release all stories to Staging for QA performance testing and Security scanning.

## Triggered By
Edward (after PM signals all stories UAT approved).

## Pre-checks
ALL must pass:
- ✓ All stories in sprint: `qa: uat-approved`
- ✓ All stories in sprint: `po: uat-approved`
- ✓ All stories in sprint: `security: cleared`
- ✓ No open critical/high bug cards in this release
- ✓ `release-readiness-assessment` complete (Release Manager)
- ✓ Changelog aggregated (Release Manager)
- ✓ Release notes drafted (Release Manager)
- ✓ Rollback plan documented

Shows pre-check results. Blocks if any fail.

## Steps
1. Merge all approved story branches into `release/v{X}.{Y}.{Z}` (all `us/{KAN-N}` → `release/` simultaneously).
2. Create RC tag: `v{X}.{Y}.{Z}-rc1` (or `rc{N+1}` if previous RCs existed).
3. CI `release-merge-pipeline` triggers: builds release candidate image tagged with RC version, pushes to Harbor.
4. ArgoCD manual sync to Staging cluster.
5. Wait for all pods healthy.
6. Run smoke tests from `test/smoke/`.
7. Update kanban release card: In Staging.
8. Notify QA: "Release v{X}.{Y}.{Z}-rc1 on Staging — begin performance + stress testing".
9. Notify Security Engineer: "Staging ready — begin ZAP full scan + pentest".

## Output
- ✅ Release v{X}.{Y}.{Z}-rc1 deployed to Staging
- QA notified for performance + stress testing
- Security Engineer notified for ZAP + pentest
- Awaiting: `staging-sign-off` from QA + `security-metrics-report`

## On Failure
- Any pre-check failing blocks the release merge and deployment entirely.

## References
- `.claude/skills/release-manager/release-readiness-assessment/SKILL.md`
- `.claude/skills/devops-engineer/staging-deployment/SKILL.md`
- `.claude/skills/qa-engineer/performance-testing/SKILL.md`
- `.claude/skills/security-engineer/zap-full-scan/SKILL.md`
