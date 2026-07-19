# `/fix` — Targeted Bug and Finding Repair

Reads errors from CI failures, `/review` findings, or production bug reports.
Fixes directly on the current branch and pushes.
Called internally by `/dev` after `/review` and after CI failures.
Also used for hotfix production bugs.

---

## Usage

```
/fix branch [branch-name]     Fix CI failures on an existing branch
/fix pr [pr-number]           Read open PR CI failures, fix on PR branch
/fix review                   Fix findings from the last /review output
/fix hotfix [version]         Fix production bugs on a hotfix branch
```

---

## Reference Documents

Read before fixing any test-related failure:

- `.claude/SOP/testing-standards.md` — test failure handling table, CI trigger map, what counts as a valid fix

---

## Shared Rules

- Never create a new branch — always fix on the branch that has the issue
- Never modify test files to make tests pass — fix the implementation
- Commit each logical group of fixes separately
- Push after all fixes in a cycle are applied — do not push per individual fix
- Maximum 3 fix cycles per invocation — post `/blocked` if still failing
- After pushing — wait for CI to complete before reporting done

---

## `/fix branch [branch-name]` — Fix CI Failures on a Branch

### Step 1 — Read CI failure

```bash
# Get latest CI run on branch
gh run list --branch [branch-name] --limit 1 --json databaseId,status,conclusion,workflowName

# Read failure logs
gh run view [run-id] --log-failed
```

Identify:

- Which workflow failed (integration-tests, sonarqube, e2e-tests)
- Which test files or checks failed
- The specific error messages

### Step 2 — Diagnose

```bash
git checkout [branch-name]
git pull origin [branch-name]
```

Read the relevant source files. Trace the error to the specific function,
component, resolver, or gRPC method that is failing.

### Step 3 — Fix

Apply fixes to the implementation files only. Do not touch:

- Test files (`.test.ts`, `.spec.ts`, `.cy.ts`)
- OpenSpec files (`.openspec/`)
- CI workflow files

For SonarQube failures — read the specific issues from the SonarQube Cloud
dashboard for the branch, address each one:

- Bugs: fix incorrect logic
- Vulnerabilities: remove or replace insecure patterns
- Code smells: refactor as indicated
- Coverage gaps: add unit tests in `./servers/[domain]/tests/unit/`

### Step 4 — Commit and push

```bash
git add [changed files]
git commit -m "fix([scope]): [what was fixed — reference error]"
git push origin [branch-name]
```

### Step 5 — Watch CI

```bash
gh run list --branch [branch-name] --limit 1 --json databaseId
gh run watch [run-id]
```

If CI passes → report done.
If CI fails again → repeat Steps 1–5 (max 3 cycles total).

After 3 cycles still failing:

```
/blocked
Command: /fix branch [branch-name]
Cycle: 3/3
Failure: [summary of error]
CI run: [link]
Waiting for: developer investigation
```

---

## `/fix pr [pr-number]` — Fix CI Failures on an Open PR

### Step 1 — Read PR details

```bash
gh pr view [pr-number] --json headRefName,baseRefName,title,url
```

Extract the head branch name. Then run `/fix branch [head-branch-name]`.

---

## `/fix review` — Fix Findings from Last /review Output

Called internally by `/dev` after `/review` completes with findings.
The findings are already in context from the `/review` run.

### Step 1 — Read findings from /review output

Parse the `/review` report from the current session context:

- Spec compliance failures: which field, which file, which line
- Code quality failures: which check, which file, which line

### Step 2 — Fix each finding

Work through findings in this order:

1. Spec compliance gaps (missing implementations, wrong output shapes)
2. GraphQL SDL issues (missing docstrings, wrong federation directives)
3. Code quality issues (hardcoded tokens, dead code, debug statements)
4. Missing UI states

For each finding:

```bash
# Edit the specific file
# Fix only what /review flagged — do not refactor unrelated code
git add [file]
git commit -m "fix([scope]): [specific finding fixed]"
```

### Step 3 — Push and trigger /review again

```bash
git push origin [current-branch]
```

Signal to `/dev` that fixes are pushed and `/review` should re-run.
Do not re-run `/review` from within `/fix` — `/dev` orchestrates the loop.

---

## `/fix hotfix [version]` — Fix Production Bugs on Hotfix Branch

Used during hotfix cycle when bugfix branch has CI failures or review findings.

### Step 1 — Identify active bugfix branch

```bash
# Find open bugfix PRs targeting the hotfix branch
gh pr list \
  --base hotfix/[version]-[desc] \
  --state open \
  --json number,headRefName,title
```

### Step 2 — Fix each failing bugfix branch

For each open bugfix PR:

```bash
git checkout bugfix/[hotfix-sub-number]-[desc]
git pull origin bugfix/[hotfix-sub-number]-[desc]
```

Read the bug description from the linked issue:

```bash
gh issue view [bugfix-issue-number] --json title,body
```

Apply fix:

- Read `rootCause` and `actualBehaviour` from the hotfix OpenSpec:
  `cat .openspec/requirements/hotfix/[version]/requirements.yaml`
- Fix the specific component/method/resolver identified
- Do not fix unrelated code

```bash
git commit -m "fix([scope]): [production bug fixed — issue #number]"
git push origin bugfix/[hotfix-sub-number]-[desc]
```

Watch CI:

```bash
gh run watch [run-id]
```

If CI passes → report PR ready for developer merge.
If CI fails → fix cycle (max 3 attempts then `/blocked`).

### Step 3 — Report

```
/fix hotfix complete — [version]

Bugfix branches fixed:
  bugfix/[number]-[desc] → PR #[pr-number] — CI ✅
  bugfix/[number]-[desc] → PR #[pr-number] — CI ✅

Please review and merge each bugfix PR into hotfix/[version]-[desc].
When all merged, run: /dev us [hotfix-issue-number]
```

---

## Stopping Conditions

Post `/blocked` and stop if:

- CI fails after 3 fix cycles
- The same finding persists after 3 fix attempts in `/fix review`
- The error points to a test file that should not be modified
- The root cause requires a spec change — post `/blocked` and flag to developer:

  ```
  /blocked
  Command: /fix [sub-command]
  Issue: Fix requires spec change — implementation cannot match current spec
  Finding: [description]
  Waiting for: developer to update .openspec/ and re-run /pr
  ```

- A production bug root cause is unknown after reading the spec and logs
