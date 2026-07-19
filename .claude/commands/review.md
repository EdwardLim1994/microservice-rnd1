# `/review` — Implementation and Release Review

Reviews feature implementation against spec and code quality standards.
Reviews the full release branch for RC readiness.
Applies fixes inline and pushes as new commits to the same branch.
CI handles SonarQube scanning — `/review` does not run local scans.

---

## Usage

```
/review [us-number]              Review all features under a user story
/review feat [feat-number]       Review one specific feature
/review release [version]        Full release branch review — RC readiness check
```

---

## Reference Documents

Read before conducting any review:

- `.claude/SOP/testing-standards.md` — what good test coverage looks like, test failure handling, CI trigger map

---

## Prerequisites

```
[ ] CLAUDE.md has been read
[ ] .claude/SOP/testing-standards.md has been read
[ ] Target branch exists and has commits
[ ] Feature sub-issue or user story issue exists (for feat/us reviews)
[ ] .openspec/requirements/[release|hotfix]/[version]/requirements.yaml exists
[ ] GitHub CLI authenticated (gh auth status)
[ ] Rover CLI available — rover --version (for release review)
```

---

## Review Scope

**Feature and user story reviews** — two dimensions:

- Spec compliance: implementation vs OpenSpec requirements
- Code quality: issues CI/SonarQube might not catch

**Release review** — ten dimensions covering full RC readiness:

- Completeness, cross-feature contracts, federation, docs,
  deployment manifest, branch cleanliness, code quality sweep,
  integration tests, e2e tests, fix cycle

CI (GitHub Actions + SonarQube Cloud) owns static analysis, security scanning,
coverage thresholds. `/review` owns spec drift, design token violations, missing
UI states, incomplete error handling, dead code, naming consistency, GraphQL docstrings.

---

## `/review feat [feat-number]` — One Specific Feature

### Phase 1 — Read inputs

```bash
gh issue view [feat-number] --json title,body

cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
# Locate feature by FEAT-[n] id

git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]

# For frontend/fullstack — fetch Claude Design project from claudeDesignURL
```

### Phase 2 — Spec compliance review

```
[ ] component implemented and matches spec name
[ ] All inputs handled per spec (types, validation, required/optional)
[ ] All outputs returned per spec (shape, fields, types)
[ ] All edge cases from edgeCases list handled with correct error responses
[ ] graphqlChanges: if true — SDL implemented in ./servers/[domain]-subgraph/src/schema/
    and Rover compose verified
[ ] claudeDesignURL: if frontend/fullstack — all components from Claude Design implemented
[ ] uiInteractions: all states implemented (loading, error, empty, success, default)
[ ] responsiveBreakpoints: responsive behaviour at specified breakpoints
[ ] Integration test plan: all INT-[n]-[n] scenarios have corresponding test cases
```

Note the specific file, function/component, and line for each failing item.

### Phase 3 — Code quality review

```
[ ] No hardcoded colour, spacing, or font size values — must use design tokens
[ ] No console.log, debug statements, or commented-out code
[ ] No dead code or unused imports
[ ] No hardcoded secrets, credentials, or environment-specific values
[ ] Error handling present and meaningful for all failure paths
[ ] Naming consistent with existing codebase conventions
[ ] GraphQL types and fields have triple-quote docstrings (if graphqlChanges: true)
[ ] No duplicate components — builds against existing component library
[ ] No new dependencies introduced without flagging to developer
```

Note the specific file and line for each failing item.

### Phase 4 — Apply fixes

For every issue found in Phase 2 or Phase 3:

1. Fix directly on the feature branch
2. Do not modify integration or e2e tests unless the test logic is wrong
3. Commit each logical group of fixes:

   ```bash
   git commit -m "fix([scope]): [what was fixed]"
   ```

4. Push all fixes:

   ```bash
   git push origin feat/[feat-number]-[short-title]
   ```

CI re-triggers automatically on push (integration tests + SonarQube).

If the same issue persists after 3 fix attempts → post `/blocked`:

```
/blocked
Branch: feat/[feat-number]-[short-title]
Issue: [description of persistent problem]
Fix attempts: 3
Waiting for: developer investigation
```

### Phase 5 — Report

```
/review complete — feat #[feat-number] [title]
Branch: feat/[feat-number]-[short-title]

Spec compliance:
  [✅|❌] component implemented
  [✅|❌] all inputs handled
  [✅|❌] all outputs returned
  [✅|❌] all edge cases handled
  [✅|❌] GraphQL SDL implemented
  [✅|❌] all UI states implemented
  [✅|❌] integration tests cover all scenarios

Code quality:
  [✅|❌] no hardcoded design tokens
  [✅|❌] no debug statements
  [✅|❌] no dead code
  [✅|❌] error handling complete
  [✅|❌] naming consistent
  [✅|❌] GraphQL docstrings present

Issues found: [n] | Fixed: [n] | Blocked: [n]
CI re-triggered on push — monitor GitHub Actions for SonarQube results.
```

---

## `/review [us-number]` — All Features Under a User Story

Run `/review feat [feat-number]` for each feature sub-issue in checklist order.
Compile consolidated report after all features reviewed:

```
/review complete — US #[us-number] [title]

Feature summary:
  #[feat-number] [title] — [n] issues found, [n] fixed
  #[feat-number] [title] — clean ✅

Total: [n] issues found, [n] fixed, [n] blocked

Next step:
  /dev us [us-number]   — open user story PR
```

---

## `/review release [version]` — Full Release Branch Review

Run this before `/pr tag rc [version]` to verify the release branch is RC-ready.
Covers ten checks. All must pass before recommending RC tag creation.

### Prerequisites

```bash
git checkout release/[version]
git pull origin release/[version]

cat .openspec/requirements/release/[version]/requirements.yaml
cat .openspec/requirements/release/[version]/deployment.yaml
```

---

### Check 1 — Completeness

Verify all user stories and features from `requirements.yaml` are done:

```bash
# List all issues in milestone
gh issue list --milestone "[version]" --json number,title,state,labels

# Verify all user story issues are closed
gh issue list --milestone "[version]" --label "user-story" --state open

# Verify all feature sub-issues are closed
gh issue list --milestone "[version]" --label "feature" --state open

# Verify all feature PRs are merged
gh pr list --base release/[version] --state open --label "feature"
```

Pass condition:

```
[ ] All user story issues closed
[ ] All feature sub-issues closed
[ ] No open feature PRs targeting release branch
[ ] Every US-[n] and FEAT-[n] in requirements.yaml has a corresponding closed issue
```

---

### Check 2 — Cross-Feature Contract Review

Read all features in `requirements.yaml` and trace data contracts between them.
Look for features where output of one feeds input of another.

For each cross-feature dependency:

```
[ ] Output type of producer matches input type of consumer
[ ] Error shapes are consistent across features that share endpoints
[ ] Auth tokens/session objects passed between features have consistent field names
[ ] GraphQL types shared across features have consistent field definitions
[ ] Any feature that consumes another feature's entity uses the correct @key field
```

If contract mismatches found — note specific features (e.g. FEAT-1 output vs FEAT-3 input)
and fix in the implementation files on `release/[version]`.

---

### Check 3 — GraphQL Federation

Only run if any feature has `graphqlChanges: true`.

```bash
# Check if any GraphQL changes exist
grep "graphqlChanges: true" .openspec/requirements/release/[version]/requirements.yaml

# If found — run Rover compose
rover supergraph compose --config ./supergraph.yaml
```

Pass condition:

```
[ ] rover supergraph compose exits with code 0
[ ] No type conflicts between subgraphs
[ ] All @external fields in stub types match their owning subgraph definitions
[ ] All @key fields are consistent across owning and referencing subgraphs
```

If Rover compose fails:

- Read error output carefully
- Fix SDL in `./servers/[domain]-subgraph/src/schema/`
- Re-run compose
- Maximum 3 fix cycles then `/blocked`

---

### Check 4 — Documentation Completeness

```bash
# List expected doc pages from requirements.yaml user stories
# Each user story should have pages in: business-logic/, api/, architecture/, data-flows/

ls ./docs/src/content/docs/business-logic/
ls ./docs/src/content/docs/api/
ls ./docs/src/content/docs/architecture/
ls ./docs/src/content/docs/data-flows/
```

For each user story in `requirements.yaml`:

```
[ ] business-logic/[us-short-title].mdx exists
[ ] api/[domain]-subgraph.mdx exists (for each affected subgraph)
[ ] architecture/[us-short-title].mdx exists
[ ] data-flows/[us-short-title].mdx exists
[ ] All pages have correct frontmatter (title, description, version, draft: true)
[ ] No placeholder content (no "[TODO]" or empty sections)
```

If any doc page is missing — create it now on `release/[version]`:

```bash
git add ./docs/
git commit -m "docs([scope]): add missing docs for release [version]"
git push origin release/[version]
```

---

### Check 5 — Deployment Manifest Verification

Cross-check `deployment.yaml` against what was actually changed in this release:

```bash
# Get diff of release branch vs main
git diff main...release/[version] --name-only
```

For each file changed:

- File in `./servers/[domain]/` → `[domain]` service should have `deploy: true`
- File in `./servers/[domain]-subgraph/` → `[domain]` gRPC server should have `deploy: true`
- File in `./frontends/[app]/` → `[app]` microfrontend should have `deploy: true`
- File in `./apps/[app]/` → `[app]` webapp/mobile should have `deploy: true` (unless mobile)
- File elsewhere → no deployment required

```
[ ] Every touched service has deploy: true in deployment.yaml
[ ] No untouched service has deploy: true (avoid unnecessary deployments)
[ ] Mobile services always deploy: false
[ ] chore: true only if no files changed under ./servers/, ./frontends/, ./apps/
```

If deployment.yaml has gaps — update it on `release/[version]`:

```bash
git add .openspec/requirements/release/[version]/deployment.yaml
git commit -m "chore(openspec): correct deployment manifest for [version]"
git push origin release/[version]
```

---

### Check 6 — Release Branch Cleanliness

```bash
# No open PRs targeting release branch (other than the future release→main PR)
gh pr list --base release/[version] --state open

# No unresolved merge conflicts
git status

# No outstanding feature or user story branches that haven't been merged
git ls-remote --heads origin | grep -E "feat/|us/" | grep "[version descriptor]"

# No uncommitted changes
git diff --stat
```

```
[ ] No open PRs targeting release/[version]
[ ] No unresolved merge conflicts
[ ] No leftover feat/** or us/** branches that should have been deleted
[ ] Working tree is clean
```

---

### Check 7 — Code Quality Sweep

Review the full diff of release branch vs main:

```bash
git diff main...release/[version] -- \
  '*.ts' '*.tsx' '*.js' '*.jsx' \
  '*.go' '*.proto' \
  '*.graphql' '*.gql'
```

Apply the same quality checklist as `/review feat` but across all changed files:

```
[ ] No hardcoded colour, spacing, or font size values across all frontend changes
[ ] No console.log or debug statements in any changed file
[ ] No dead code or unused imports across all changes
[ ] No hardcoded secrets or credentials anywhere in the diff
[ ] Error handling complete in all changed service methods and components
[ ] Naming consistent with existing codebase conventions throughout
[ ] GraphQL docstrings present on all new types and fields
[ ] No duplicate components introduced across any frontend changes
```

Fix issues directly on `release/[version]`, commit, push. CI re-triggers on push.

---

### Check 8 — Integration Tests on Release Branch

Trigger CI integration tests on the release branch:

```bash
# Push a no-op commit to trigger CI if branch hasn't been pushed recently
git commit --allow-empty -m "chore: trigger ci for release review"
git push origin release/[version]

# Wait for integration test workflow to complete
gh run list --branch release/[version] --workflow integration-tests.yml --limit 1
gh run watch [run-id]
```

Pass condition:

```
[ ] integration-tests.yml exits with status: completed / conclusion: success
```

If tests fail:

- Read failure: `gh run view [run-id] --log-failed`
- Fix on `release/[version]`, push, wait for CI
- Maximum 3 fix cycles then `/blocked`

---

### Check 9 — e2e Tests via workflow_dispatch

Trigger e2e tests manually on the release branch using `workflow_dispatch`:

```bash
# Trigger e2e workflow on release branch
gh workflow run e2e-tests.yml \
  --ref release/[version] \
  --field environment=review

# Get the run ID
sleep 5
gh run list \
  --workflow e2e-tests.yml \
  --branch release/[version] \
  --limit 1 \
  --json databaseId,status,conclusion

# Watch until complete
gh run watch [run-id]
```

Pass condition:

```
[ ] e2e-tests.yml exits with status: completed / conclusion: success
[ ] All Vitest API tests passing
[ ] All Cypress browser tests passing
[ ] No Cypress screenshot artifacts (indicates no visual failures)
```

If e2e fails:

- Read failure: `gh run view [run-id] --log-failed`
- Download Cypress screenshots if available:

  ```bash
  gh run download [run-id] --name cypress-screenshots
  ```

- Identify failing test names and trace to the relevant feature
- Fix on `release/[version]`, push, re-trigger workflow
- Maximum 3 fix cycles then post `/blocked` with failing test names and run link

---

### Check 10 — Fix Cycle for Release Branch Issues

For any issues found in Checks 1–9:

1. Fix directly on `release/[version]`
2. Group fixes by type into meaningful commits:

   ```bash
   git commit -m "fix([scope]): [what was fixed]"
   git commit -m "docs([scope]): [what was added]"
   git commit -m "chore(openspec): [what was corrected]"
   ```

3. Push to release branch — CI re-triggers automatically
4. Re-run the specific failing check after push to confirm it now passes
5. Do not re-run all 10 checks from the start — only re-run the ones that failed

---

### Release Review Report

```
/review release complete — [version]

━━━ Completeness ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  User stories closed:      [n]/[n] ✅
  Feature sub-issues closed: [n]/[n] ✅
  Open PRs on release:      0 ✅

━━━ Cross-Feature Contracts ━━━━━━━━━━━━━━━━
  [✅|❌] Contract: FEAT-[n] output → FEAT-[n] input
  [✅|❌] Error shapes consistent
  Issues found: [n] | Fixed: [n]

━━━ GraphQL Federation ━━━━━━━━━━━━━━━━━━━━━
  [✅|❌|N/A] rover supergraph compose
  Issues found: [n] | Fixed: [n]

━━━ Documentation ━━━━━━━━━━━━━━━━━━━━━━━━━━
  [✅|❌] business-logic pages: [n]/[n]
  [✅|❌] api pages: [n]/[n]
  [✅|❌] architecture pages: [n]/[n]
  [✅|❌] data-flows pages: [n]/[n]
  Missing pages created: [n]

━━━ Deployment Manifest ━━━━━━━━━━━━━━━━━━━━
  [✅|❌] deployment.yaml matches actual changes
  Corrections made: [n]

━━━ Branch Cleanliness ━━━━━━━━━━━━━━━━━━━━━
  [✅|❌] No open PRs
  [✅|❌] No leftover branches
  [✅|❌] Working tree clean

━━━ Code Quality ━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Files reviewed: [n] changed files
  Issues found: [n] | Fixed: [n]

━━━ Integration Tests ━━━━━━━━━━━━━━━━━━━━━━
  [✅|❌] CI run: [link]
  Status: [passed|failed]

━━━ e2e Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [✅|❌] e2e run: [link]
  Vitest API: [n] passed, [n] failed
  Cypress: [n] passed, [n] failed

━━━ Overall ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total issues found: [n]
  Total fixed: [n]
  Blocked: [n]

[If all checks pass:]
  Release [version] is RC-ready ✅
  Run: /pr tag rc [version]

[If any checks blocked:]
  Release [version] is NOT RC-ready ❌
  Resolve blocked items before tagging.
  Blocked items:
    - [description] — see /blocked comment on #[issue]
```

---

## Stopping Conditions

Post `/blocked` and stop if:

- Feature branch does not exist (`/review feat`)
- OpenSpec file cannot be read
- Claude Design URL is inaccessible for a frontend feature
- Same issue persists after 3 fix cycles on any branch
- Rover compose fails after 3 fix cycles (`/review release`)
- Integration tests fail after 3 fix cycles (`/review release`)
- e2e tests fail after 3 fix cycles (`/review release`)
