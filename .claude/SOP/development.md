# Role SOP — Development (`/dev`)

## Responsibility
Implement features on feature branches. Pass all quality gates. Open feature PRs and wait for developer merge. Open user story PR only when explicitly instructed by the developer after all features are merged.

## Prerequisites (verify before acting)
```
[ ] CLAUDE.md has been read
[ ] A /handoff dev comment exists on the target feature sub-issue (posted by /qa)
[ ] Feature branch exists (git ls-remote --heads origin feat/[number]-[title])
[ ] Integration tests exist on the feature branch (tests/integration/)
[ ] GitHub CLI is authenticated (gh auth status)
[ ] SONAR_TOKEN is available in environment
```

If any prerequisite fails — post a `/blocked` comment on the feature sub-issue and stop.

---

## Phase 1 — Read Inputs

```
1. Read the feature sub-issue (gh issue view [number])
2. Read the parent user story issue for full context
3. Read .claude/requirements/[release-name].md for the original spec
4. For frontend/fullstack features:
   - Fetch the Claude Design project from the URL in the sub-issue
   - Load component tree, design tokens, and layout hierarchy from the project
5. Read existing integration tests to understand what must pass
```

---

## Phase 2 — Implement

```bash
git checkout feat/[number]-[title]
git pull origin feat/[number]-[title]
```

### Implementation Rules

**General**
- Implement exactly what is specified in the sub-issue technical spec — no more, no less
- Do not modify integration or e2e tests to make them pass — fix the implementation
- Commit incrementally using conventional commit messages
- Each commit should represent a coherent unit of work

**Backend features**
- Implement the endpoint or function defined in the technical spec
- Handle all edge cases listed in the sub-issue
- Return consistent error shapes for all failure paths
- Do not introduce new dependencies without flagging to the developer

**Frontend / Fullstack features**
- Load the Claude Design project from the URL in the sub-issue before writing any code
- Use component tree from Claude Design as the structural source of truth
- Use design tokens from Claude Design — never hardcode colours, spacing, or font sizes
- Implement all UI states: default, loading, error, empty, success
- Implement all interactions from the sub-issue interaction notes
- Apply responsive behaviour per breakpoints in the sub-issue (default: mobile-first)
- Build against the existing component library — do not create duplicate components

### Commit pattern
```
feat([scope]): [what was implemented]
fix([scope]): [what was corrected]
refactor([scope]): [what was restructured]
```

---

## Phase 3 — Quality Gates

All three gates must pass before opening a PR. Fix and re-push until clear.

### Gate 1 — Integration Tests
```
Run integration tests locally
If failing:
  - Read failing test output carefully
  - Fix the implementation (not the tests)
  - Re-run until all pass
  - Push and confirm GitHub Actions integration test workflow passes
  - Maximum 3 fix cycles — if still failing after 3, post /blocked on sub-issue
```

### Gate 2 — SonarQube Cloud
```
Push branch → SonarQube Cloud scan triggers automatically via GitHub integration
Poll for Quality Gate result:
  GET https://sonarcloud.io/api/qualitygates/project_status?projectKey=[key]

If FAILED:
  - Read issues from SonarQube Cloud dashboard
  - Fix each issue (bugs, vulnerabilities, code smells, coverage gaps)
  - Re-push and re-poll
  - Maximum 3 fix cycles — if still failing after 3, post /blocked on sub-issue

If PASSED: proceed to Gate 3
```

### Gate 3 — Self Code Review
```
Review all changes in the current branch against the base user story branch.
Checklist:
[ ] No hardcoded secrets or credentials
[ ] No console.log or debug statements left in
[ ] No commented-out code
[ ] Error handling present for all failure paths
[ ] Code matches the spec in the sub-issue exactly
[ ] No dead code or unused imports introduced
[ ] Naming is consistent with existing codebase conventions
[ ] Frontend: no hardcoded design token values
[ ] Frontend: all UI states implemented

If any item fails — fix before proceeding.
```

---

## Phase 4 — Open Feature PR

Only open the PR after all three gates pass.

```bash
gh pr create \
  --title "[FEAT-{number}] {feature title}" \
  --base us/[number]-[title] \
  --body "[use PR template below]" \
  --draft=false
```

### Feature PR Template
```markdown
## Linked Issue
Closes #[sub-issue-number]

## Summary
[What was implemented and why — 2 to 4 sentences]

## Changes
- [change 1]
- [change 2]

## Test Evidence
- [ ] Integration tests: ✅ passing (GitHub Actions run: [link])
- [ ] SonarQube Quality Gate: ✅ PASSED ([link to report])

## Self-Review Checklist
- [ ] No hardcoded secrets
- [ ] No debug statements
- [ ] No commented-out code
- [ ] Error handling complete
- [ ] Code matches spec
- [ ] No dead code or unused imports
- [ ] Naming consistent with codebase

## UI Changes (frontend PRs only)
| Before | After |
|---|---|
| N/A | [screenshot of implemented UI] |
```

### Post handoff comment on sub-issue
```
/handoff merge
PR: #[pr-number]
Branch: feat/[number]-[title] → us/[number]-[title]
Gates passed:
- Integration tests: ✅ [Actions run link]
- SonarQube: ✅ [report link]
- Self-review: ✅
Status: Ready for QA review, then your merge.
```

**Stop here. Do not open the user story PR. Wait for the developer to merge the feature PR and explicitly instruct you to open the next feature PR or the user story PR.**

---

## Phase 5 — Repeat for Each Feature

After the developer merges a feature PR and instructs Dev to continue:

```
1. Confirm the merged feature sub-issue is now closed
2. Move to the next feature sub-issue that has a /handoff dev comment
3. Repeat Phases 1–4 for that feature
4. After opening its PR — stop and wait for developer merge and instruction again
```

Do not open multiple feature PRs simultaneously. One feature at a time, in sequence.

---

## Phase 6 — Open User Story PR

**This phase is triggered only by an explicit developer instruction** such as:
- "Open the user story PR"
- "All features are merged, open the US PR"
- "/dev open us PR for [user story title]"

Do not open the user story PR autonomously. Do not infer that all features are merged and proceed — wait for the instruction.

When instructed:

```
1. Confirm all feature sub-issues are closed (gh issue list --label feature)
2. Confirm all feature PRs are merged into the user story branch
3. Confirm e2e tests exist in ./e2e for this user story
4. Open user story PR:

gh pr create \
  --title "[US-{number}] {user story title}" \
  --base release/[release-name] \
  --body "[use US PR template below]" \
  --draft=false
```

Opening the user story PR triggers the GitHub Actions e2e workflow, which spins up a local kind cluster and runs both Vitest API tests and Cypress browser tests against it.

### User Story PR Template
```markdown
## Linked Issue
Closes #[user-story-issue-number]

## Summary
[What this user story delivers — 2 to 4 sentences]

## Features Included
- #[feat-issue-number] [FEAT] Feature title (PR #[pr-number])
- #[feat-issue-number] [FEAT] Feature title (PR #[pr-number])

## Test Evidence
- [ ] Integration tests: ✅ all passing (per feature PRs)
- [ ] SonarQube Quality Gate: ✅ PASSED for all feature branches
- [ ] e2e tests: 🔄 will run on PR creation (kind cluster + Vitest API + Cypress)

## Notes
[Any implementation decisions worth flagging for UAT]
```

### Post handoff comment on user story issue
```
/handoff merge
PR: #[pr-number]
Branch: us/[number]-[title] → release/[release-name]
e2e: triggered on PR creation — monitor GitHub Actions for results
Status: Ready for your review. Merge once e2e passes.
```

---

## Stopping Conditions

Post a `/blocked` comment and stop if:
- No `/handoff dev` comment exists on the sub-issue
- Integration tests do not exist on the feature branch
- A Claude Design URL in the sub-issue is inaccessible
- Integration tests fail after 3 fix cycles
- SonarQube Quality Gate fails after 3 fix cycles
- A merge conflict on the feature branch cannot be resolved automatically
- Developer has not yet instructed Dev to open the user story PR — do not proceed autonomously