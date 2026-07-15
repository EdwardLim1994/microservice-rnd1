# `/dev` — Feature Development

Implements features, writes integration tests, and opens PRs.
Never merges locally — every branch transition goes through a PR.

---

## Usage

```
/dev [us-number]              Implement all features under a user story sequentially
/dev feat [feat-number]       Implement one specific feature
/dev us [us-number]           Open user story PR (us → release)
/dev bugfix [bugfix-number]   Fix a bugfix branch and open PR
/dev hotfix [version]         Implement all bugfix branches under a hotfix sequentially
```

---

## Shared Rules (All Sub-Commands)

- Never merge locally — every branch transition requires a PR
- Never modify integration or e2e tests to make them pass — fix the implementation
- CI must pass before opening any PR:
  - Push branch → wait for GitHub Actions to complete
  - If CI fails → fix on the same branch, push again, wait for CI
  - If CI fails after 3 fix cycles → create bugfix issue (user story branch only)
    or post `/blocked` (feature/bugfix/hotfix branch)
- All PRs follow the PR template defined below
- Commit using conventional commits: `type(scope): description`

---

## `/dev [us-number]` — All Features Under a User Story

### Step 1 — Read inputs

```bash
gh issue view [us-number] --json title,body,labels,milestone
```

Extract sub-issue list from the issue body. Read each feature sub-issue:
```bash
gh issue view [feat-number] --json title,body,labels
```

Read OpenSpec:
```bash
cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
```

Determine feature order from the sub-issue checklist in the user story issue.

### Step 2 — For each feature, sequentially:

Execute all phases of `/dev feat [feat-number]` (see below).
After opening each feature PR — continue immediately to the next feature
without waiting for the PR to be merged.

Repeat until all features have PRs open.

### Step 3 — Report complete

```
/dev complete — all features for US #[us-number]

Features implemented:
  #[feat-number] [title] → PR #[pr-number] (feat/[branch] → us/[branch])
  #[feat-number] [title] → PR #[pr-number]
  ...

All feature PRs are open. Please review and merge each one.
When all are merged, run:
  /dev us [us-number]   — to open the user story PR
```

---

## `/dev feat [feat-number]` — One Specific Feature

### Phase 1 — Read inputs

```bash
gh issue view [feat-number] --json title,body,labels
```

Read from issue body:
- Technical spec (component, input, output, edge cases)
- GraphQL schema changes (if applicable)
- UI spec (Claude Design URL, interactions, breakpoints)
- Integration test plan
- Parent user story branch

For frontend/fullstack:
- Fetch Claude Design project from `claudeDesignURL`
- Load component tree, design tokens, layout hierarchy

For GraphQL changes:
- Read `.openspec/requirements/[release|hotfix]/[version]/[domain]-subgraph.api.graphql`

### Phase 2 — Write integration tests first

Tests written before implementation. Expected to fail initially.

**Backend features** — in `./servers/[domain]-subgraph/tests/integration/`:
```typescript
import { describe, it, expect } from 'vitest'

describe('[Feature title] — Integration', () => {
  it('[INT-n-n scenario]', async () => {
    // Call endpoint/service directly
    // Assert response matches spec output
  })

  it('handles [edge case]', async () => {
    // Assert correct error response
  })
})
```

**Frontend features** — in `./[frontend-project]/tests/integration/`:
```typescript
describe('[Feature title] — Component Integration', () => {
  it('renders [UI state]', () => {
    // Mount component, assert state from claudeDesignURL spec
  })

  it('shows loading state', () => { /* ... */ })
  it('shows error state', () => { /* ... */ })
  it('shows empty state', () => { /* ... */ })
})
```

Commit tests:
```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
git add tests/
git commit -m "test(integration): add integration tests for [feature title]"
git push origin feat/[feat-number]-[short-title]
```

### Phase 3 — Implement

Checkout feature branch:
```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
```

**Backend:**
- Implement endpoint or gRPC method per technical spec
- Handle all edge cases from the issue
- Return consistent error shapes for all failure paths
- No new dependencies without flagging to developer

**GraphQL schema changes (if `graphqlChanges: true`):**
- Implement SDL changes in `./servers/[domain]-subgraph/src/schema/`
- Owning subgraph: add full type with `@key`
- Referencing subgraphs: add stub with `@key` and `@external`
- Run Rover compose to verify:
  ```bash
  rover supergraph compose --config ./supergraph.yaml
  ```
- If Rover compose fails → fix SDL before continuing

**Frontend/Fullstack:**
- Load component tree from Claude Design project URL
- Use design tokens from Claude Design — never hardcode colours, spacing, font sizes
- Implement all UI states: default, loading, error, empty, success
- Implement all interactions from `uiInteractions` in the spec
- Apply responsive behaviour from `responsiveBreakpoints`
- Build against existing component library — no duplicate components

Commit incrementally:
```bash
git commit -m "feat([scope]): [what was implemented]"
git push origin feat/[feat-number]-[short-title]
```

### Phase 4 — Write API docs

After implementing the feature, write or update:
`./docs/src/content/docs/api/[domain]-subgraph.mdx`

```mdx
---
title: [Subgraph] API
description: [one sentence]
version: [version]
draft: true
---
[Document new mutations/queries/methods added in this feature]
```

Commit:
```bash
git add ./docs/
git commit -m "docs([scope]): add api docs for [feature title]"
git push origin feat/[feat-number]-[short-title]
```

### Phase 5 — Wait for CI

After pushing:
```bash
# Poll GitHub Actions until complete
gh run list --branch feat/[feat-number]-[short-title] --limit 1
gh run watch [run-id]
```

**If CI passes** → proceed to Phase 6

**If CI fails:**
- Read failure output: `gh run view [run-id] --log-failed`
- Fix on the same branch
- Push and wait for CI again
- Maximum 3 fix cycles
- If still failing after 3 cycles → post `/blocked`:
  ```
  /blocked
  Branch: feat/[feat-number]-[short-title]
  CI failed after 3 fix attempts
  Failure: [summary of failure]
  Waiting for: developer investigation
  ```

### Phase 6 — Open feature PR

```bash
gh pr create \
  --title "[FEAT-[feat-number]] [feature title]" \
  --base us/[us-number]-[us-short-title] \
  --body "[PR template below]" \
  --draft=false
```

PR template:
```markdown
## Linked Issue
Closes #[feat-number]

## Summary
[What was implemented — 2 to 4 sentences]

## Changes
- [change 1]
- [change 2]

## Test Evidence
- Integration tests: ✅ CI passing ([Actions run link])
- SonarQube: ✅ Quality Gate passed ([CI run link])

## UI Changes (frontend PRs only)
| Before | After |
|---|---|
| N/A | [screenshot] |

## GraphQL Changes (if applicable)
- Subgraphs updated: [list]
- Rover compose: ✅ verified
```

Report:
```
Feature PR opened
PR: #[pr-number]
Branch: feat/[feat-number]-[short-title] → us/[us-number]-[us-short-title]
CI: ✅ passing
```

---

## `/dev us [us-number]` — Open User Story PR

### Step 1 — Verify all features merged

```bash
gh issue view [us-number] --json body
# Check all sub-issue checkboxes are checked

gh pr list --base us/[us-number]-[short-title] --state open
# Must be empty — no open feature PRs
```

If any feature PRs are still open → report which ones and stop.

### Step 2 — Write architecture and data flow docs

`./docs/src/content/docs/architecture/[us-short-title].mdx`
`./docs/src/content/docs/data-flows/[us-short-title].mdx`

```mdx
---
title: [Title]
description: [one sentence]
version: [version]
draft: true
---
[Document architecture decisions and data flow for this user story]
```

Commit:
```bash
git checkout us/[us-number]-[short-title]
git add ./docs/
git commit -m "docs([scope]): add architecture and data flow docs for [us title]"
git push origin us/[us-number]-[short-title]
```

### Step 3 — Open user story PR

```bash
gh pr create \
  --title "[US-[us-number]] [user story title]" \
  --base release/[version] \
  --body "[US PR template below]" \
  --draft=false
```

US PR template:
```markdown
## Linked Issue
Closes #[us-number]

## Summary
[What this user story delivers — 2 to 4 sentences]

## Features Included
- #[feat-number] [FEAT] [title] (PR #[pr-number]) ✅
- #[feat-number] [FEAT] [title] (PR #[pr-number]) ✅

## Test Evidence
- Integration tests: ✅ all passing (per feature PRs)
- SonarQube: ✅ all feature branches passed
- e2e tests: 🔄 will trigger on PR creation (kind cluster)

## Docs
- Business logic: `docs/src/content/docs/business-logic/[us-short-title].mdx` ✅
- API: `docs/src/content/docs/api/[domain]-subgraph.mdx` ✅
- Architecture: `docs/src/content/docs/architecture/[us-short-title].mdx` ✅
- Data flows: `docs/src/content/docs/data-flows/[us-short-title].mdx` ✅
```

Opening this PR triggers the e2e GitHub Actions workflow (kind cluster).

Report:
```
User story PR opened
PR: #[pr-number]
Branch: us/[us-number]-[short-title] → release/[version]
e2e: triggered on PR creation — monitor GitHub Actions
```

---

## `/dev bugfix [bugfix-number]` — Fix a Bugfix Branch

### Step 1 — Read inputs

```bash
gh issue view [bugfix-number] --json title,body
```

Extract from issue body:
- Failing checks (integration tests / SonarQube)
- Source branch (user story branch)
- Bugfix branch name

### Step 2 — Investigate and fix

```bash
git checkout bugfix/[us-issue-number]-[short-description]
git pull origin bugfix/[us-issue-number]-[short-description]

# Read CI failure output
gh run list --branch bugfix/[us-issue-number]-[short-description] --limit 1
gh run view [run-id] --log-failed
```

Fix the issue on the bugfix branch. Commit:
```bash
git commit -m "fix([scope]): [what was fixed]"
git push origin bugfix/[us-issue-number]-[short-description]
```

### Step 3 — Wait for CI

Poll until CI completes. If fails → fix and retry (max 3 cycles).
If still failing after 3 cycles → post `/blocked`.

### Step 4 — Open bugfix PR

```bash
gh pr create \
  --title "[BUG-[bugfix-number]] [bugfix title]" \
  --base us/[us-issue-number]-[us-short-title] \
  --body "[bugfix PR template below]" \
  --draft=false
```

Bugfix PR template:
```markdown
## Linked Issue
Closes #[bugfix-number]

## Bug Fixed
[What was failing and what was changed]

## Test Evidence
- CI: ✅ passing ([Actions run link])
- SonarQube: ✅ Quality Gate passed
```

---

## `/dev hotfix [version]` — All Bugfix Branches Under a Hotfix

### Step 1 — Read hotfix OpenSpec

```bash
cat .openspec/requirements/hotfix/[version]/requirements.yaml
```

List all `bugs:` entries and their corresponding bugfix issue numbers.

### Step 2 — For each bugfix issue, sequentially:

Execute `/dev bugfix [bugfix-number]` for each bug.
Open a PR per bugfix branch into the hotfix branch.
Continue to next bugfix without waiting for merge.

### Step 3 — Report complete

```
/dev hotfix complete — [version]

Bugfixes implemented:
  #[bugfix-number] [title] → PR #[pr-number]
  #[bugfix-number] [title] → PR #[pr-number]

All bugfix PRs open. Please review and merge each one.
When all are merged, run:
  /dev us [hotfix-issue-number]   — to open the hotfix → main PR
```

---

## Stopping Conditions

Post `/blocked` and stop if:
- Feature sub-issue has no technical spec
- Frontend feature `claudeDesignURL` is null or inaccessible
- Rover supergraph compose fails after SDL implementation
- CI fails after 3 fix cycles on any branch
- User story has open feature PRs when `/dev us` is called