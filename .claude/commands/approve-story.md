# /approve-story KAN-{N}

## Purpose
Edward's approval to merge a user story into the release branch and deploy it to the UAT environment.

## Triggered By
Edward (after seeing story is ready — all labels present).

## Pre-checks
ALL must pass or execution blocked:
- ✓ All task PRs merged to feature branches
- ✓ All feature PRs merged to story branch (`us/{KAN-N}`)
- ✓ `qa: uat-approved` label present on story PR
- ✓ `po: uat-approved` label present on story PR
- ✓ `security: cleared` label present on story PR
- ✓ Tech Lead approval on story PR
- ✓ SonarQube quality gate: green
- ✓ No open critical/high bug cards linked to this story
- ✓ `story-changelog-writing`: `openspec/changes/{slug}/CHANGELOG.md` exists
- ✓ `/opsx:archive` run for this story's OpenSpec change

Shows pre-check results to Edward. Blocks if any fail.

## Steps
1. Add approval comment to kanban card: "Approved by Edward — {timestamp}".
2. Merge story PR (`us/{KAN-N}`) into `release/v{X}.{Y}.{Z}`.
3. CI `story-merge-pipeline` triggers: builds image `{service}-{branch-slug}-{commit-hash}`, pushes to Harbor, Harbor Trivy scan runs.
4. PM adds `uat-ready` label to story PR.
5. ArgoCD ApplicationSet detects label: spins up namespace `uat-{branch-slug}`, deploys story to UAT, configures Traefik `uat-{KAN-N}.uat.internal`.
6. Update kanban card: In UAT.
7. Notify QA: "Story KAN-{N} deployed to UAT at uat-{KAN-N}.uat.internal".
8. Notify PO: "Story KAN-{N} ready for business validation at same URL".
9. Run `/opsx:archive` for this story's OpenSpec change.

## Output
- ✅ Story KAN-{N} merged and deployed to UAT
- UAT URL: `uat-{KAN-N}.uat.internal`
- QA + PO notified

## On Failure
- If any pre-check fails: show specific failures, block merge.
- If image build fails: notify DevOps, story stays in current branch.
- If ArgoCD fails to deploy: notify DevOps, QA not notified until resolved.

## References
- `.claude/skills/qa-engineer/uat-sign-off/SKILL.md`
- `.claude/skills/devops-engineer/story-merge-pipeline/SKILL.md`
- `.claude/skills/devops-engineer/uat-environment-management/SKILL.md`
