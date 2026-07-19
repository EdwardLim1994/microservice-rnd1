# `/dev` — Feature Development

Implements features with a spec-first, test-driven approach.
Automatically runs /review and /fix after implementation.
Opens PR only when /review is clean and CI passes.
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

## Reference Documents

Read before starting any feature implementation:

- `.claude/SOP/testing-standards.md` — unit test patterns (Rstest, Vitest + RTL), rules, CI triggers

---

## Shared Rules

- QA PR must be merged into the user story branch before /dev starts
- Never merge locally — every branch transition goes through a PR
- Never modify test files to make tests pass — fix the implementation
- Unit tests use Rstest — live inside each `./servers/[domain]/tests/unit/`
- Run tests with `turbo run test` from monorepo root
- CI must pass before opening any PR — max 3 fix cycles then /blocked
- /review runs automatically after implementation — /fix runs on any findings
- Commit using conventional commits: `type(scope): description`

---

## `/dev [us-number]` — All Features Under a User Story

### Step 0 — Verify QA PR is merged

```bash
# Check QA PR is merged (not open)
gh pr list \
  --base us/[us-number]-[short-title] \
  --label "qa" \
  --state open

# If any open QA PRs exist — stop
```

If QA PR is still open:

```
/blocked
Command: /dev [us-number]
Issue: QA PR is not yet merged into us/[us-number]-[short-title]
Waiting for: developer to review and merge the QA PR (#[pr-number])
             before /dev can begin
```

### Step 1 — Read inputs

```bash
gh issue view [us-number] --json title,body,labels,milestone
cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
```

List all feature sub-issues from the user story checklist. Read each:

```bash
gh issue view [feat-number] --json title,body,labels
```

### Step 2 — Implement all features sequentially

For each feature, execute `/dev feat [feat-number]` (see below).
After opening each feature PR, continue immediately to the next feature
without waiting for the PR to be merged.

### Step 3 — Report complete

```
/dev complete — all features for US #[us-number]

Features implemented:
  #[feat-number] [title] → PR #[pr-number] (feat/[branch] → us/[branch]) CI ✅
  #[feat-number] [title] → PR #[pr-number] CI ✅

All feature PRs open. Please review and merge each one.
When all are merged, run:
  /dev us [us-number]   — to open the user story PR
```

---

## `/dev feat [feat-number]` — One Specific Feature

### Phase 1 — Read and list requirements

```bash
gh issue view [feat-number] --json title,body
cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
# Locate feature by FEAT-[n] id
```

Print a requirements summary before writing any code:

```
Feature: [FEAT-n] [title]
Type: [backend | frontend | fullstack]
Component: [component name]

Functions/methods needed:
  - [function signature 1] — [what it does]
  - [function signature 2] — [what it does]

GraphQL operations (if graphqlChanges: true):
  - [mutation/query name] — [what it does]

UI components (if frontend/fullstack):
  - [component name] — [states: loading, error, empty, success]

Inputs:
  [input description from spec]

Outputs:
  [output description from spec]

Edge cases to handle:
  - [edge case 1]
  - [edge case 2]
```

For frontend/fullstack — fetch Claude Design project from `claudeDesignURL` and
add component tree to the summary before proceeding.

### Phase 2 — Checkout feature branch

```bash
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]
```

### Phase 3 — Write unit tests (spec-first)

Write unit tests based on the function signatures listed in Phase 1.
Tests are written before implementation — they will fail initially.

**Backend (Rstest) — in `./servers/[domain]/tests/unit/`:**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    // One test per function signature from Phase 1
    #[rstest]
    #[case([valid input], [expected output])]
    #[case([edge case input], [expected error])]
    fn test_[function_name](#[case] input: [Type], #[case] expected: [Type]) {
        // Arrange
        let sut = [Component]::new();

        // Act
        let result = sut.[function_name](input);

        // Assert
        assert_eq!(result, expected);
    }

    // Additional coverage tests beyond the spec scenarios
    #[test]
    fn test_[function_name]_[additional_scenario]() {
        // ...
    }
}
```

**Frontend (Vitest + React Testing Library) — in `./[frontend]/tests/unit/`:**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

describe('[ComponentName]', () => {
  it('[function/behaviour from Phase 1 summary]', () => {
    // Arrange
    render(<[ComponentName] [props] />)

    // Act
    fireEvent.click(screen.getByTestId('[data-testid]'))

    // Assert
    expect(screen.getByTestId('[result]')).toBeInTheDocument()
  })

  // Additional coverage beyond spec
  it('handles [additional scenario]', () => {
    // ...
  })
})
```

Rules:

- Write at least one test per function signature from Phase 1
- Add additional tests for boundary conditions and less obvious paths
- Claude Code is free to add more tests for better coverage
- Tests must reference only the function signatures — do not import implementation yet

Commit unit tests:

```bash
git add tests/unit/
git commit -m "test(unit): add unit tests for [feature title]"
```

### Phase 4 — Run tests (expect failure)

```bash
turbo run test --filter=[domain or app name]
```

Tests should fail at this point — implementation does not exist yet.
Confirm failure output makes sense (function not found, not incorrect logic).
If tests pass at this stage → the test logic may be wrong — review before proceeding.

### Phase 5 — Implement

**Backend:**

- Implement each function/method from Phase 1 summary
- Handle all edge cases from spec
- Return consistent error shapes for all failure paths
- No new dependencies without flagging to developer

**GraphQL schema changes (if `graphqlChanges: true`):**

```bash
# Implement SDL in ./servers/[domain]-subgraph/src/schema/
# Then verify federation
rover supergraph compose --config ./supergraph.yaml
```

If Rover compose fails → fix SDL before continuing.

**Frontend/Fullstack:**

- Use component tree from Claude Design project as structural source of truth
- Use design tokens from Claude Design — never hardcode colours, spacing, font sizes
- Implement all UI states: default, loading, error, empty, success
- Implement all interactions from `uiInteractions` in spec
- Apply responsive behaviour from `responsiveBreakpoints`
- Use `data-testid` attributes on all interactive and state elements

Commit incrementally:

```bash
git commit -m "feat([scope]): implement [what was built]"
```

### Phase 6 — Run tests until passing

```bash
turbo run test --filter=[domain or app name]
```

If tests fail:

- Read failure output
- Fix the implementation (never the tests)
- Re-run
- Repeat until all unit tests pass

Once passing:

```bash
git commit -m "feat([scope]): all unit tests passing for [feature title]"
git push origin feat/[feat-number]-[short-title]
```

### Phase 7 — Write API docs

After implementation, write or update:
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

### Phase 8 — Auto-run /review

Read `.claude/commands/review.md` and run `/review feat [feat-number]`.

If `/review` finds issues:

- Automatically call `/fix review`
- Read `.claude/commands/fix.md` and execute `/fix review`
- After `/fix` pushes → re-run `/review feat [feat-number]`
- Repeat until `/review` reports clean

Maximum 3 review+fix cycles. If still not clean:

```
/blocked
Command: /dev feat [feat-number]
Phase: review+fix cycle
Cycle: 3/3
Remaining findings: [list]
Waiting for: developer investigation
```

### Phase 9 — Watch CI before opening PR

```bash
# CI should have triggered on the last push
gh run list --branch feat/[feat-number]-[short-title] --limit 1 --json databaseId,status,conclusion
gh run watch [run-id]
```

**If CI passes** → proceed to Phase 10.

**If CI fails:**

- Read `.claude/commands/fix.md`
- Run `/fix branch feat/[feat-number]-[short-title]`
- After fix pushed → watch CI again
- Maximum 3 fix cycles
- If still failing → post `/blocked`

### Phase 10 — Open feature PR

```bash
gh pr create \
  --title "[FEAT-[feat-number]] [feature title]" \
  --base us/[us-number]-[us-short-title] \
  --body "[PR template below]" \
  --draft=false
```

Feature PR template:

```markdown
## Linked Issue
Closes #[feat-number]

## Summary
[What was implemented — 2 to 4 sentences]

## Changes
- [change 1]
- [change 2]

## Test Evidence
- Unit tests: ✅ turbo run test passing
- Integration tests: written by QA (PR #[qa-pr-number]) ✅
- CI: ✅ integration-tests + sonarqube passing ([Actions run link])

## Review
- /review: ✅ clean (no findings)

## GraphQL Changes
[If graphqlChanges: true]
- Subgraphs updated: [list]
- Rover compose: ✅ verified

[If graphqlChanges: false]
- No GraphQL changes

## UI Changes (frontend PRs only)
| Before | After |
|---|---|
| N/A | [screenshot] |
```

Report:

```
Feature PR opened
PR: #[pr-number]
Branch: feat/[feat-number]-[short-title] → us/[us-number]-[us-short-title]
Unit tests: ✅ passing (turbo run test)
CI: ✅ passing
/review: ✅ clean
```

---

## `/dev us [us-number]` — Open User Story PR

### Step 1 — Verify all features merged

```bash
# All feature sub-issues must be closed
gh issue list \
  --milestone "[version]" \
  --label "feature" \
  --state open \
  --json number,title

# No open feature PRs into user story branch
gh pr list \
  --base us/[us-number]-[short-title] \
  --state open \
  --json number,title,labels
```

If any feature PRs are still open → report which ones and stop.

### Step 2 — Write architecture and data flow docs

```bash
git checkout us/[us-number]-[short-title]
git pull origin us/[us-number]-[short-title]
```

Create:

- `./docs/src/content/docs/architecture/[us-short-title].mdx`
- `./docs/src/content/docs/data-flows/[us-short-title].mdx`

```bash
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

## QA
- QA PR: #[qa-pr-number] ✅ merged
- Integration tests: ./e2e/integration/[us-short-title]/ ✅
- e2e tests (Cypress headless): ./e2e/cypress/e2e/[us-short-title]/ ✅

## Test Evidence
- Unit tests: ✅ all feature branches passing
- CI (integration + SonarQube): ✅ all feature PRs passed
- e2e tests: 🔄 will trigger on PR creation (kind cluster)

## Docs
- Business logic: ✅
- API: ✅
- Architecture: ✅
- Data flows: ✅
```

Opening this PR triggers e2e GitHub Actions workflow (kind cluster).

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

Extract: failing checks, source branch, bugfix branch name.

### Step 2 — Read failure

```bash
git checkout bugfix/[source-number]-[short-description]
git pull origin bugfix/[source-number]-[short-description]

gh run list --branch bugfix/[source-number]-[short-description] --limit 1
gh run view [run-id] --log-failed
```

### Step 3 — Fix

Run `/fix branch bugfix/[source-number]-[short-description]`.
Read `.claude/commands/fix.md` and execute.

### Step 4 — Open bugfix PR

Once CI passes:

```bash
gh pr create \
  --title "[BUG-[bugfix-number]] [bugfix title]" \
  --base [parent-branch] \
  --body "[bugfix PR template]" \
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

List all `bugs:` entries and their bugfix issue numbers.

### Step 2 — For each bugfix issue, sequentially

Execute `/dev bugfix [bugfix-number]` for each.
Open a PR per bugfix branch into the hotfix branch.
Continue to next bugfix without waiting for merge.

### Step 3 — Report complete

```
/dev hotfix complete — [version]

Bugfixes:
  #[bugfix-number] [title] → PR #[pr-number] CI ✅
  #[bugfix-number] [title] → PR #[pr-number] CI ✅

Review and merge each bugfix PR into hotfix/[version]-[desc].
When all merged, run:
  /dev us [hotfix-issue-number]
```

---

## Stopping Conditions

Post `/blocked` and stop if:

- QA PR not merged when `/dev [us-number]` is called
- Feature sub-issue has no technical spec
- Frontend feature `claudeDesignURL` is null or inaccessible
- Rover supergraph compose fails after SDL implementation
- Unit tests still failing after 3 implementation fix cycles
- /review+/fix cycle exceeds 3 iterations
- CI fails after 3 fix cycles on any branch
- User story has open feature PRs when `/dev us` is called
