# Handoff Rules — Shared Across All Roles

This document defines how work is handed off between roles. All role SOPs reference this file. Handoffs are signalled via GitHub issue comments so there is a permanent, traceable record.

---

## Handoff Sequence Overview

```
🧑 Developer
  → creates release branch
  → places requirements document at .claude/requirements/[release-name].md

🤖 /pm (Project Management)
  → reads requirements document
  → creates user story issues + feature sub-issues
  → creates user story branches + feature branches
  → comments on each user story issue: "PM handoff complete — QA to write tests"

🤖 /qa (QA)
  → reads user story issue + sub-issues
  → writes Playwright e2e tests on user story branch
  → writes integration tests on each feature branch
  → comments on each feature sub-issue: "QA handoff complete — Dev to implement"

🤖 /dev (Development)
  → reads feature sub-issue
  → implements feature on feature branch
  → passes all quality gates (tests + SonarQube + self-review)
  → opens feature PR (feat → user story branch)
  → comments on sub-issue: "Dev handoff complete — PR #[number] ready for QA review and merge"
  → STOPS and waits for developer merge and explicit instruction to continue

🧑 Developer
  → reviews QA approval and feature PR
  → merges feature PR (feat → user story branch)
  → repeats for each feature
  → once all features merged: explicitly instructs Dev to open user story PR

🤖 /dev (Development) — only when explicitly instructed by developer
  → opens user story PR (us → release branch)
  → e2e GitHub Actions workflow triggers on PR creation (spins up kind cluster)

🧑 Developer
  → monitors e2e results on the user story PR
  → reviews and merges user story PR once e2e passes
  → full UAT runs on release branch

🤖 /devops (DevOps)
  → triggered when release branch is ready for deployment
  → provisions or updates infrastructure (Terraform)
  → updates Helm charts for the release
  → comments on release milestone: "DevOps handoff complete — infrastructure ready for deployment"

🧑 Developer
  → final UAT sign-off
  → merges release branch into main
```

---

## Handoff Comment Templates

Each role must post the exact comment below when handing off. This allows the next role to search GitHub issues for their trigger.

### PM → QA
```
/handoff qa
User story branch: us/[number]-[title]
Feature branches: feat/[number]-[title], feat/[number]-[title]
OpenSpec: .openspec/requirements/release/[version]/requirements.yaml
Status: Issues and branches created. Ready for test authoring.
```

### QA → Dev
```
/handoff dev
Feature branch: feat/[number]-[title]
Sub-issue: #[number]
Tests written:
- Integration: [test file path]
Status: Tests failing as expected (no implementation yet). Ready for development.
```

### Dev → Developer (PR ready)
```
/handoff merge
PR: #[pr-number]
Branch: feat/[number]-[title] → us/[number]-[title]
Gates passed:
- Integration tests: ✅ [Actions run link]
- SonarQube: ✅ [report link]
- Self-review: ✅
Status: Ready for your review and merge.
```

### QA → Dev (all features written, ready for development)
```
/handoff dev
All integration tests written across feature branches.
e2e tests written in ./e2e for user story: us/[number]-[title]
Status: All feature branches ready for development. Start with feat/[number]-[title].
```

### QA → Developer (post all-feature-merge, US PR ready to be instructed)
```
/handoff developer
All feature sub-issues closed and feature PRs merged into us/[number]-[title]
e2e tests: written and waiting in ./e2e/
Status: Please instruct Dev to open the user story PR when ready.
```

### DevOps → Developer (infrastructure ready)
```
/handoff deploy
Release: [release-name]
Terraform: applied ✅
Helm: updated ✅
Environment: [staging | production]
Status: Infrastructure ready. UAT can proceed.
```

---

## Tag and UAT Handoff Comments

### /pr tag rc → Developer (RC tag created)
```
RC tag created: v[version]-rc[n]
UAT deployment triggered via GitHub Actions deploy-uat.yml
Monitor: GitHub Actions → deploy-uat workflow

When UAT is complete:
  Passed  → tell Claude Code: "UAT sign off [version]"
  Failed  → leave a comment on the release PR describing the issue
            then run: /pr uat-fix [version]
```

### /pr uat-fix → Developer (UAT fix ready)
```
UAT fix issue created: #[issue-number]
Bugfix branch: bugfix/[release-version]-[short-description]

Run: /dev bugfix [issue-number]

After fix merged into release/[version]:
Run: /pr tag rc [version]   → creates v[version]-rc[n+1]
```

### /pr tag stable → Developer (stable tag and release PR)
```
Stable tag created: v[version]
Production deployment triggered via GitHub Actions deploy-production.yml
Release PR opened: #[pr-number] (release/[version] → main)

Please verify production using the checklist in the PR body.
When satisfied, merge PR #[pr-number] to complete the release.
```

### /pr tag hotfix-stable → Developer (hotfix stable tag and PR)
```
Hotfix stable tag created: v[version]
Production deployment triggered
Hotfix PR opened: #[pr-number] (hotfix/[version]-[desc] → main)

Note: This is a patch version bump [prev-version] → [version]
Verify production using checklist in PR body, then merge.
```

---

## Bugfix Handoff Comments

### PM → Dev (CI failure on feature branch — Scenario A)
```
/handoff dev
Trigger: CI failure on feat/[number]-[title]
Failed: [integration tests | SonarQube | both]
Actions run: [link]
Status: Fix directly on feat/[number]-[title]. Re-push to re-trigger CI. No new branch needed.
```

### PM → Dev (CI failure on user story branch — Scenario B)
```
/handoff dev
Bugfix branch: bugfix/[us-issue-number]-[short-description]
Bugfix issue: #[bugfix-issue-number]
Parent: us/[us-issue-number]-[short-title]
Failed checks: [list]
Actions run: [link]
Status: Fix on bugfix branch. Same quality gates apply. Open PR back into us/[us-issue-number]-[short-title] when passing.
```

---

## Hotfix Handoff Comments

### PM → QA (hotfix setup complete)
```
/handoff qa
Mode: HOTFIX
Hotfix branch: hotfix/[new-version]-[short-description]
Bugfix branches: bugfix/[number]-[desc], bugfix/[number]-[desc]
Milestone: hotfix/[new-version]
Labels assigned: ✅
Branch links: ✅
Status: Treat bugfix branches as feature branches and hotfix branch as user story branch. Full QA flow applies.
```

### Dev → Developer (hotfix PR ready)
```
/handoff merge
Mode: HOTFIX
PR: #[pr-number]
Branch: hotfix/[new-version]-[desc] → main
e2e: triggered on PR creation (kind cluster)
Version bump: [X.Y.Z] → [X.Y.Z+1] — please bump on merge
Status: Ready for your review. Merge and bump version when e2e passes.
```

---

---

## Blocking Rules (All Roles)

Any role must stop and post a blocking comment on the relevant GitHub issue if:

- A required input from a prior role is missing or malformed
- A handoff comment from the prior role has not been posted
- A quality gate fails after 3 fix attempts
- A merge conflict cannot be resolved automatically

Blocking comment format:
```
/blocked
Role: [pm | qa | dev | devops]
Issue: [description of the blocker]
Waiting for: [what is needed to unblock]
```

The developer is responsible for resolving blocks and re-triggering the relevant role session.