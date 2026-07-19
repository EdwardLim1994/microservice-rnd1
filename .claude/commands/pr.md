# `/pr` — Issue, Branch Setup and Release Management

Handles the full lifecycle of a release or hotfix:

- Creates release/hotfix branch, issues, and feature branches
- Manages RC and stable tags for UAT and production deployment
- Opens release→main and hotfix→main PRs
- Handles UAT failure bugfix flow

---

## Usage

```
/pr [version]                    Create release branch, issues, branches
/pr hotfix [version]             Create hotfix branch, issues, bugfix branches
/pr tag rc [version]             Create RC tag → triggers UAT deployment
/pr tag stable [version]         Create stable tag → triggers production deployment + open release PR
/pr tag hotfix-rc [version]      Create hotfix RC tag → triggers UAT deployment
/pr tag hotfix-stable [version]  Create hotfix stable tag → triggers production + open hotfix PR
/pr uat-fix [version]            Read release branch PR comments, create bugfix from release branch
```

---

## `/pr [version]` — Release Setup

### Prerequisites

```
[ ] CLAUDE.md has been read
[ ] .openspec/requirements/release/[version]/requirements.yaml exists
[ ] .openspec/requirements/release/[version]/deployment.yaml exists
[ ] git is authenticated
[ ] GitHub CLI authenticated (gh auth status)
[ ] ./servers/ exists to derive service names
```

### Phase 1 — Validate OpenSpec files

```bash
cat .openspec/requirements/release/[version]/requirements.yaml
cat .openspec/requirements/release/[version]/deployment.yaml
ls .openspec/requirements/release/[version]/*.graphql 2>/dev/null
```

Validate requirements.yaml:

- All top-level fields present: `release`, `date`, `releaseBranch`, `userStories`
- All user stories have `acceptanceCriteria` and `features`
- All features have `type`, `component`, `graphqlChanges`
- Frontend/fullstack features have non-null `claudeDesignURL`
- No `PENDING` markers remain

Validate deployment.yaml:

- `release` matches version
- `chore` is `true` or `false`
- Each service has `name`, `type`, `path`, `deploy`
- `type` is one of: `grpc`, `microfrontend`, `webapp`, `mobile`
- `path` points to an existing folder in the repo
- Mobile services have `deploy: false` (placeholder only)

If validation fails — list all issues and stop.

### Phase 2 — Create Release Branch

```bash
git checkout main
git pull origin main
git checkout -b release/[version]
git push -u origin release/[version]
```

### Phase 3 — Commit OpenSpec to Release Branch

```bash
git add .openspec/requirements/release/[version]/
git commit -m "chore(openspec): add requirements and deployment manifest for [version]"
git push origin release/[version]
```

### Phase 4 — Ensure Labels Exist

```bash
gh label list
```

Create any missing:

| Label | Colour | Description |
|---|---|---|
| `user-story` | `#0075ca` | Main user story issue |
| `feature` | `#e4e669` | Feature sub-issue |
| `backend` | `#d93f0b` | Backend feature |
| `frontend` | `#0052cc` | Frontend feature |
| `fullstack` | `#6f42c1` | Fullstack feature |
| `e2e` | `#00b5ad` | Relates to e2e testing |
| `bug` | `#d73a4a` | Something not working |
| `bugfix` | `#e99695` | Fix for a CI/CD or UAT bug |
| `hotfix` | `#b60205` | Production hotfix |
| `production-bug` | `#e4e669` | Bug found in production |
| `uat-fix` | `#f9d0c4` | Fix for UAT failure |
| `release/[version]` | `#bfd4f2` | Scoped to this release |

### Phase 5 — Create Milestone

```bash
gh api repos/:owner/:repo/milestones \
  --method POST \
  --field title="[version]" \
  --field description="Release [version]"
```

### Phase 6 — Create GitHub Issues

For each user story in requirements.yaml:

**User story issue**

```bash
gh issue create \
  --title "[US] [title]" \
  --body "[template]" \
  --label "user-story,release/[version]" \
  --label "e2e" \
  --milestone "[version]"
```

User story issue template:

```markdown
## User Story
As a [persona], I want to [goal] so that [outcome].

## Acceptance Criteria
- [ ] [criterion]

## e2e Test Plan
- [E2E-n] Given [given] / When [when] / Then [then]

## Sub-Issues
[populated after sub-issues are created]

## OpenSpec
`.openspec/requirements/release/[version]/requirements.yaml` — [US-n]

## Branches
- User story branch: `us/[issue-number]-[short-title]`
```

**Feature sub-issues**

```bash
gh issue create \
  --title "[FEAT] [title]" \
  --body "[template]" \
  --label "feature,release/[version],[backend|frontend|fullstack]" \
  --milestone "[version]"
```

Feature sub-issue template:

```markdown
## Feature Description
[description]

## Technical Spec
- Component: [component]
- Type: [type]
- Input: [input]
- Output: [output]
- Edge cases: [list]

## GraphQL Schema Changes
[If graphqlChanges: true]
- Affected subgraphs: [list]
- Schema: `.openspec/requirements/release/[version]/[domain]-subgraph.api.graphql`

[If graphqlChanges: false]
- No GraphQL changes

## UI Spec
[Frontend/fullstack only]
- Claude Design URL: [claudeDesignURL]
- Interactions: [uiInteractions]
- Breakpoints: [responsiveBreakpoints]

## Integration Test Plan
- [INT-n-n] [scenario]

## OpenSpec
`.openspec/requirements/release/[version]/requirements.yaml` — [FEAT-n]

## Branches
- Feature branch: `feat/[issue-number]-[short-title]`
- Parent: `us/[us-issue-number]-[us-short-title]`

## Parent Issue
Part of #[us-issue-number]

## Definition of Done
- [ ] Integration tests passing (CI)
- [ ] SonarQube Quality Gate passed (CI)
- [ ] PR opened and linked to this issue
```

Update user story sub-issue checklist after all sub-issues created.

### Phase 7 — Create Branches and Link to Issues

**Release branch already exists from Phase 2.**

**User story branches**

```bash
git checkout release/[version]
git pull origin release/[version]
git checkout -b us/[issue-number]-[short-title]
git push -u origin us/[issue-number]-[short-title]
```

**Feature branches**

```bash
git checkout us/[us-issue-number]-[short-title]
git checkout -b feat/[issue-number]-[short-title]
git push -u origin feat/[issue-number]-[short-title]
```

**Link branches to issues**

```bash
gh issue view [issue-number] --json developmentBranches

# If not auto-linked:
gh api repos/:owner/:repo/issues/[issue-number]/branches \
  --method POST \
  --field branch="[branch-name]"
```

### Phase 8 — Infer and Validate Deployment Manifest

Cross-check `deployment.yaml` against the actual monorepo structure:

```bash
# List all service folders
ls ./servers/          # gRPC servers and subgraphs
ls ./frontends/        # microfrontends
ls ./apps/             # webpages and mobile apps
```

For each entry in `deployment.yaml` with `deploy: true`:

- Verify `path` exists in the repo
- For `type: grpc` — verify corresponding `./servers/[name]-subgraph/` exists if `subgraph` field is set
- For `type: mobile` — `deploy` must always be `false` (placeholder only)

If any `deploy: true` path does not exist → report warning (do not block, developer may add the service later).

### Phase 9 — Write Business Logic Docs

For each user story create:
`./docs/src/content/docs/business-logic/[us-short-title].mdx`

```mdx
---
title: [User story title]
description: [one sentence]
version: [version]
draft: true
---

## Overview
[What this user story delivers]

## Acceptance Criteria
[List from requirements.yaml]

## Related
- OpenSpec: `.openspec/requirements/release/[version]/requirements.yaml` — [US-n]
```

Commit docs to release branch:

```bash
git checkout release/[version]
git add ./docs/
git commit -m "docs: add business logic docs for [version]"
git push origin release/[version]
```

### Phase 10 — Report Complete

```
/pr complete — release [version]

Release branch: release/[version] ✅
OpenSpec committed: ✅

Issues created:
  [n] user stories
  [n] feature sub-issues

Branches created:
  us/[number]-[title]
  feat/[number]-[title]
  ...

Deployment manifest:
  Services to deploy: [list of deploy: true services]
  Chore release: [true | false]

Next steps:
  /e2e [us-number]    — write e2e tests per user story
  /dev [us-number]    — implement features per user story
```

---

## `/pr hotfix [version]` — Hotfix Setup

Hotfix is at the same level as a release branch. Version bumps patch: `X.Y.Z` → `X.Y.(Z+1)`.

### Phase H1 — Validate hotfix OpenSpec

```bash
cat .openspec/requirements/hotfix/[version]/requirements.yaml
cat .openspec/requirements/hotfix/[version]/deployment.yaml
```

Same validation rules as release. `bugs:` key instead of `userStories:`.

### Phase H2 — Create Hotfix Branch from Main

```bash
git checkout main
git pull origin main
git checkout -b hotfix/[version]-[short-description]
git push -u origin hotfix/[version]-[short-description]
```

Format: `hotfix/[version]-[short-description]`
Example: `hotfix/1.0.1-payment-crash`

### Phase H3 — Commit OpenSpec to Hotfix Branch

```bash
git add .openspec/requirements/hotfix/[version]/
git commit -m "chore(openspec): add hotfix requirements for [version]"
git push origin hotfix/[version]-[short-description]
```

### Phase H4 — Ensure Hotfix Labels

```bash
gh label create "hotfix" --color "b60205" --description "Production hotfix"
gh label create "production-bug" --color "e4e669" --description "Bug found in production"
```

### Phase H5 — Create Milestone

```bash
gh api repos/:owner/:repo/milestones \
  --method POST \
  --field title="hotfix/[version]" \
  --field description="Hotfix [version] — production bug fixes"
```

### Phase H6 — Create Hotfix Issues

**Hotfix parent issue**

```bash
gh issue create \
  --title "[HOTFIX] [short description]" \
  --body "[hotfix parent template]" \
  --label "hotfix,production-bug" \
  --milestone "hotfix/[version]"
```

Hotfix parent template:

```markdown
## Production Problem
[What is broken and user impact]

## Current Version
[X.Y.Z]

## Hotfix Version
[X.Y.(Z+1)]

## Sub-Issues
[populated after sub-issues created]

## Branches
- Hotfix branch: `hotfix/[version]-[short-description]`

## RC Tag
[populated when /pr tag hotfix-rc is run]

## Production Tag
[populated when /pr tag hotfix-stable is run]
```

**Bug sub-issues (one per bug in requirements.yaml)**

```bash
gh issue create \
  --title "[BUG] [specific bug title]" \
  --body "[bug sub-issue template]" \
  --label "hotfix,production-bug,[backend|frontend|fullstack]" \
  --milestone "hotfix/[version]"
```

Bug sub-issue template:

```markdown
## Bug Description
[actualBehaviour from requirements.yaml]

## User Impact
[userImpact]

## Technical Spec
- Component: [component]
- Root cause: [rootCause]
- Expected: [expectedBehaviour]
- Actual: [actualBehaviour]

## GraphQL Schema Changes
[same format as feature sub-issue]

## OpenSpec
`.openspec/requirements/hotfix/[version]/requirements.yaml` — [BUG-n]

## Bugfix Branch
`bugfix/[hotfix-sub-issue-number]-[short-description]`

## Parent Issue
Part of #[hotfix-issue-number]

## Definition of Done
- [ ] CI passing on bugfix branch
- [ ] SonarQube Quality Gate passed (CI)
- [ ] PR merged into hotfix branch
```

### Phase H7 — Create Bugfix Branches

```bash
git checkout hotfix/[version]-[short-description]
git checkout -b bugfix/[hotfix-sub-issue-number]-[short-description]
git push -u origin bugfix/[hotfix-sub-issue-number]-[short-description]
```

Link each bugfix branch to its sub-issue. Repeat for all bugs.

### Phase H8 — Report Complete

```
/pr hotfix complete — [version]

Hotfix branch: hotfix/[version]-[short-description] ✅
OpenSpec committed: ✅
Issues: [n] bugs under hotfix #[number]
Bugfix branches: [list]

Next steps:
  /e2e [hotfix-issue-number]    — write e2e tests
  /dev hotfix [version]          — implement all bugfixes
```

---

## `/pr tag rc [version]` — Create RC Tag

Run after all user story PRs are merged into `release/[version]`.

```bash
# Determine next RC number
git tag --list "v[version]-rc*" | sort -V | tail -1
# If none exist → rc1. If v[version]-rc1 exists → rc2, etc.

RC_NUM="rc[n]"
TAG="v[version]-${RC_NUM}"

git checkout release/[version]
git pull origin release/[version]
git tag -a "${TAG}" -m "Release candidate ${TAG}"
git push origin "${TAG}"
```

Update release milestone issue with RC tag:

```bash
gh issue edit [release-tracking-issue] --body "[updated body adding RC tag line]"
```

Add to release PR body (if already open):

```markdown
## RC Tags
- `v[version]-rc1` — [date] — UAT deployment triggered
```

Report:

```
RC tag created: v[version]-rc[n]
CI/CD will deploy to UAT environment.
Monitor GitHub Actions tag workflow for deployment status.

When UAT is complete:
  UAT passed → tell Claude Code "UAT sign off [version]"
  UAT failed → leave a comment on the release PR describing the issue
               then run: /pr uat-fix [version]
```

---

## `/pr tag stable [version]` — Create Stable Tag and Open Release PR

Run after UAT sign off.

### Step 1 — Create stable tag

```bash
TAG="v[version]"
git checkout release/[version]
git pull origin release/[version]
git tag -a "${TAG}" -m "Release [version]"
git push origin "${TAG}"
```

### Step 2 — Open release → main PR

```bash
gh pr create \
  --title "Release [version]" \
  --base main \
  --head release/[version] \
  --body "[release PR template]"
```

Release PR template:

```markdown
## Release [version]

## User Stories
- #[us-number] [US] [title] ✅
- #[us-number] [US] [title] ✅

## RC Tags
- `v[version]-rc1` — [date]
- `v[version]-rc2` — [date] (if UAT fixes were needed)

## Stable Tag
`v[version]` — production deployment triggered on tag push

## Services Deployed
[From deployment.yaml — list deploy: true services]

## Production Verification Checklist
- [ ] [service-name] health check passing
- [ ] [service-name] smoke test passing
- [ ] Key user flows verified in production
- [ ] No errors in production logs
- [ ] Rollback plan confirmed if needed

## Notes
[Any release notes or migration steps]
```

Report:

```
Stable tag created: v[version]
Production deployment triggered via CI/CD tag workflow.
Release PR opened: #[pr-number] (release/[version] → main)

Please verify production using the checklist in the PR body.
When satisfied, merge the PR to complete the release.
```

---

## `/pr uat-fix [version]` — Handle UAT Failure

Triggered when you leave a comment on the release PR describing a UAT failure.

### Step 1 — Read release PR comments

```bash
# Find the release PR
gh pr list --base main --head release/[version] --json number,url | jq '.[0]'

# Read all comments
gh pr view [pr-number] --json comments
```

Identify comments from the developer describing UAT failures. Extract:

- What failed (CI / SonarQube / e2e / manual verification)
- Which service or flow is affected
- Any reproduction steps provided

### Step 2 — Create UAT fix issue

```bash
gh issue create \
  --title "[UAT-FIX] [short description of failure]" \
  --body "[uat-fix template]" \
  --label "bug,uat-fix,release/[version]" \
  --milestone "[version]"
```

UAT fix issue template:

```markdown
## UAT Failure Description
[Summary of what failed from PR comment]

## Source
Release PR: #[pr-number]
Comment: [link to specific comment]

## Failure Type
- [ ] CI failed
- [ ] SonarQube failed
- [ ] e2e failed
- [ ] Manual verification failed

## Bugfix Branch
`bugfix/[release-version]-[short-description]`

## Definition of Done
- [ ] Fix implemented on bugfix branch
- [ ] CI passing
- [ ] PR merged into release/[version]
- [ ] RC tag bumped
```

### Step 3 — Create bugfix branch from release branch

```bash
git checkout release/[version]
git pull origin release/[version]
git checkout -b bugfix/[release-version]-[short-description]
git push -u origin bugfix/[release-version]-[short-description]
```

Format: `bugfix/[release-version]-[short-description]`
Example: `bugfix/v1.0.0-payment-null-pointer`

Link branch to UAT fix issue.

### Step 4 — Report

```
UAT fix issue created: #[issue-number]
Bugfix branch: bugfix/[release-version]-[short-description]

Run: /dev bugfix [issue-number]

After fix is merged into release/[version]:
Run: /pr tag rc [version]   — to create next RC tag and re-trigger UAT
```

---

## `/pr tag hotfix-rc [version]` — Hotfix RC Tag

Same as `/pr tag rc` but targets the hotfix branch:

```bash
TAG="v[version]-rc[n]"
git checkout hotfix/[version]-[desc]
git pull origin hotfix/[version]-[desc]
git tag -a "${TAG}" -m "Hotfix release candidate ${TAG}"
git push origin "${TAG}"
```

---

## `/pr tag hotfix-stable [version]` — Hotfix Stable Tag and PR

Same as `/pr tag stable` but targets hotfix → main:

```bash
TAG="v[version]"
git tag -a "${TAG}" -m "Hotfix [version]"
git push origin "${TAG}"

gh pr create \
  --title "Hotfix [version]" \
  --base main \
  --head hotfix/[version]-[desc] \
  --body "[hotfix PR template]"
```

Hotfix PR template:

```markdown
## Hotfix [version]

## Production Problem Fixed
[From hotfix parent issue]

## Bugs Fixed
- #[bug-number] [BUG] [title] ✅
- #[bug-number] [BUG] [title] ✅

## RC Tags
- `v[version]-rc1` — [date]

## Stable Tag
`v[version]` — production deployment triggered

## Version Bump
`[previous-version]` → `[version]` (patch bump)

## Services Deployed
[From deployment.yaml]

## Production Verification Checklist
- [ ] Fixed flow verified in production
- [ ] No regression in related flows
- [ ] Error logs clean
- [ ] Rollback plan confirmed

## Notes
[Any notes about the fix]
```

---

## Bugfix Issue Creation (CI failure on user story branch)

When CI fails on a `us/**` branch after feature PRs are merged:

```bash
gh issue create \
  --title "[BUG] [short description of CI failure]" \
  --body "[bugfix template]" \
  --label "bug,bugfix,release/[version]" \
  --milestone "[version]"
```

Bugfix branch from user story branch:

```bash
git checkout us/[us-issue-number]-[short-title]
git pull origin us/[us-issue-number]-[short-title]
git checkout -b bugfix/[us-issue-number]-[short-description]
git push -u origin bugfix/[us-issue-number]-[short-description]
```

Report:

```
Bugfix issue #[number] created.
Bugfix branch: bugfix/[us-issue-number]-[short-description]
Run: /dev bugfix [bugfix-issue-number]
```

---

## Branch Lifecycle Summary

| Branch | Created from | Merged into | Via | Deleted after |
|---|---|---|---|---|
| `release/[version]` | `main` | `main` | PR (developer) | Never — kept as ref |
| `us/[number]-[title]` | `release/` | `release/` | PR (developer) | After merge |
| `feat/[number]-[title]` | `us/` | `us/` | PR (developer) | After merge |
| `bugfix/[us-number]-[desc]` | `us/` | `us/` | PR (developer) | After us/ merges |
| `bugfix/[release-ver]-[desc]` | `release/` | `release/` | PR (developer) | After release tag |
| `hotfix/[version]-[desc]` | `main` | `main` | PR (developer) | Never — kept as ref |
| `bugfix/[hotfix-sub-number]-[desc]` | `hotfix/` | `hotfix/` | PR (developer) | After hotfix merge |

---

## Stopping Conditions

Post `/blocked` and stop if:

- `.openspec/` files missing or fail validation
- `git checkout main && git pull` fails (authentication or network)
- Any `deploy: true` service path does not exist (warn, do not block)
- GitHub CLI authentication fails
- Branch creation fails on remote
- Tag already exists when trying to create it

