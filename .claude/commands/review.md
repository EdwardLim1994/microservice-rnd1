# `/review` — Implementation Review

Reviews feature implementation against spec and code quality standards.
Applies fixes inline and pushes as new commits to the same branch.
CI handles SonarQube scanning — `/review` does not run local scans.

---

## Usage

```
/review [us-number]           Review all features under a user story
/review feat [feat-number]    Review one specific feature
```

---

## Prerequisites

```
[ ] CLAUDE.md has been read
[ ] Target branch exists and has commits
[ ] Feature sub-issue or user story issue exists
[ ] .openspec/requirements/[release|hotfix]/[version]/requirements.yaml exists
```

---

## Review Scope

Two dimensions reviewed on every call:

**1. Spec compliance** — does the implementation match the OpenSpec requirements?
**2. Code quality** — are there issues that CI/SonarQube might not catch?

CI (GitHub Actions + SonarQube Cloud) owns:
- Static analysis, security scanning, coverage thresholds

`/review` owns:
- Spec-to-implementation drift
- Hardcoded design token values
- Missing UI states
- Incomplete error handling
- Dead code and unused imports
- Naming consistency with existing codebase
- Missing docstrings on GraphQL types/fields

---

## `/review [us-number]` — All Features Under a User Story

Run `/review feat [feat-number]` for each feature sub-issue under the user story,
in the order they appear in the sub-issue checklist.

Compile a consolidated report after all features are reviewed.

---

## `/review feat [feat-number]` — One Specific Feature

### Phase 1 — Read inputs

```bash
# Read feature issue
gh issue view [feat-number] --json title,body

# Read OpenSpec spec for this feature
cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
# Locate feature by FEAT-[n] id

# Checkout the feature branch
git checkout feat/[feat-number]-[short-title]
git pull origin feat/[feat-number]-[short-title]

# For frontend/fullstack — fetch Claude Design project
# claudeDesignURL from the feature spec
```

---

### Phase 2 — Spec Compliance Review

Compare implementation against every field in the OpenSpec feature spec:

```
[ ] component implemented and matches spec name
[ ] All inputs handled per spec (types, validation, required/optional)
[ ] All outputs returned per spec (shape, fields, types)
[ ] All edge cases from edgeCases list handled with correct error responses
[ ] graphqlChanges: if true — SDL implemented in ./servers/[domain]-subgraph/src/schema/
    and Rover compose verified
[ ] claudeDesignURL: if frontend/fullstack — all components from Claude Design project implemented
[ ] uiInteractions: all states implemented (loading, error, empty, success, default)
[ ] responsiveBreakpoints: responsive behaviour implemented at specified breakpoints
[ ] Integration test plan: all INT-[n]-[n] scenarios have corresponding test cases
```

For each failing item — note the specific file, function/component, and line where the gap exists.

---

### Phase 3 — Code Quality Review

```
[ ] No hardcoded colour, spacing, or font size values (frontend — must use design tokens)
[ ] No console.log, debug statements, or commented-out code
[ ] No dead code or unused imports
[ ] No hardcoded secrets, credentials, or environment-specific values
[ ] Error handling present and meaningful for all failure paths
[ ] Naming consistent with existing codebase conventions
[ ] GraphQL types and fields have triple-quote docstrings (if graphqlChanges: true)
[ ] No duplicate components — builds against existing component library
[ ] No new dependencies introduced without flagging to developer
```

For each failing item — note the specific file and line.

---

### Phase 4 — Apply Fixes

For every issue found in Phase 2 or Phase 3:

1. Fix directly on the feature branch
2. Do not modify integration or e2e tests unless the test logic is wrong
3. Commit each logical group of fixes:
   ```bash
   git commit -m "fix([scope]): [what was fixed]"
   ```
4. After all fixes are applied:
   ```bash
   git push origin feat/[feat-number]-[short-title]
   ```

CI will re-trigger automatically on push (integration tests + SonarQube).

If the same issue persists after 3 fix attempts → post `/blocked`:
```
/blocked
Branch: feat/[feat-number]-[short-title]
Issue: [description of persistent problem]
Fix attempts: 3
Waiting for: developer investigation
```

---

### Phase 5 — Report

```
/review complete — feat #[feat-number] [title]
Branch: feat/[feat-number]-[short-title]

Spec compliance:
  [✅ | ❌] component implemented
  [✅ | ❌] all inputs handled
  [✅ | ❌] all outputs returned
  [✅ | ❌] all edge cases handled
  [✅ | ❌] GraphQL SDL implemented
  [✅ | ❌] all UI states implemented
  [✅ | ❌] integration tests cover all scenarios

Code quality:
  [✅ | ❌] no hardcoded design tokens
  [✅ | ❌] no debug statements
  [✅ | ❌] no dead code
  [✅ | ❌] error handling complete
  [✅ | ❌] naming consistent
  [✅ | ❌] GraphQL docstrings present

Issues found: [n]
Fixed and pushed: [n]
Still open (blocked): [n]

CI re-triggered on push — monitor GitHub Actions for SonarQube results.
```

---

## Consolidated Report (for `/review [us-number]`)

After reviewing all features:

```
/review complete — US #[us-number] [title]

Feature summary:
  #[feat-number] [title] — [n] issues found, [n] fixed
  #[feat-number] [title] — [n] issues found, [n] fixed
  #[feat-number] [title] — clean ✅

Total issues found: [n]
Total fixed: [n]
Blocked: [n]

Next step:
  /dev us [us-number]   — open user story PR (if all features look good)
```

---

## Stopping Conditions

Post `/blocked` and stop if:
- Feature branch does not exist
- OpenSpec file cannot be read
- Claude Design URL is inaccessible for a frontend feature
- Same issue persists after 3 fix cycles