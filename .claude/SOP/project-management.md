# Role SOP — Project Management (`/pm`)

## Responsibility
Generate `.openspec` requirement files, create GitHub labels, milestones, issues, and branches from those files. Link branches to issues. Manage bugfix and hotfix flows. Signal QA when ready.

## Subgraph Naming Convention
All GraphQL subgraphs follow the format `[domain]-subgraph`.
Examples: `auth-subgraph`, `order-subgraph`, `payment-subgraph`, `inventory-subgraph`

The domain name is derived from the service folder name in `./servers/[domain]-subgraph/`.
Claude Code must never invent subgraph names — derive them from the existing monorepo structure.

## OpenSpec File Structure
```
.openspec/
└── requirements/
    ├── release/
    │   └── [version]/
    │       ├── requirements.yaml                    ← user stories, features, test plans
    │       └── [domain]-subgraph.api.graphql        ← one per affected subgraph (if graphqlChanges: true)
    └── hotfix/
        └── [version]/
            ├── requirements.yaml
            └── [domain]-subgraph.api.graphql
```

---

## Prerequisites (verify before acting)
```
[ ] CLAUDE.md has been read
[ ] GitHub CLI is authenticated (gh auth status)
[ ] ./servers/ directory exists to derive subgraph names from
```

If any prerequisite fails — post a `/blocked` comment and stop.

---

## Phase 0 — OpenSpec Validation

This phase runs when `.openspec/` files have been written by the bootstrap script
but have not yet been validated by Claude Code.

Skip Phase 0 entirely if:
- A `run-state.json` exists and shows Phase 0 already completed
- `/pm` is being resumed mid-SDLC (issues and branches already exist)

### Step 1 — Read OpenSpec files from repo

```bash
# Identify version from the requirements.yaml
cat .openspec/requirements/[release|hotfix]/[version]/requirements.yaml

# List any SDL files present
ls .openspec/requirements/[release|hotfix]/[version]/*.graphql 2>/dev/null
```

If `requirements.yaml` does not exist:
```
/blocked
Role: pm
Issue: .openspec/requirements/[release|hotfix]/[version]/requirements.yaml not found
Waiting for: Developer to run the bootstrap script generated from the Claude Project chat:
  bash bootstrap-[version].sh
Then re-run this session.
```

### Step 2 — Validate requirements.yaml

Run every check below. Collect ALL failures before reporting — do not stop at the first error.

**Schema validation**
```
[ ] Top-level fields present: release, date, releaseBranch, userStories
[ ] release matches semver format (e.g. 1.0.0 or 1.0.1)
[ ] releaseBranch matches format release/[version]
[ ] hotfix: true present if this is a hotfix, uses bugs: key instead of userStories:
[ ] affectedSubgraphs present if any feature has graphqlChanges: true
[ ] affectedSubgraphs values match ./servers/[domain]-subgraph/ folders in monorepo
```

**Per user story (or bug for hotfix)**
```
[ ] id present and follows format US-[n] (or BUG-[n] for hotfix)
[ ] title, persona, goal, outcome all present and non-empty
[ ] acceptanceCriteria present with at least one item
[ ] e2eTestPlan present with at least one scenario
[ ] Each e2e scenario has: id, scenario, given, when, then
[ ] labels includes e2e if any feature is frontend or fullstack
[ ] features present with at least one item
```

**Per feature**
```
[ ] id present and follows format FEAT-[n]
[ ] title, description, component, input, output all present and non-empty
[ ] type is one of: backend, frontend, fullstack
[ ] edgeCases present with at least one item
[ ] claudeDesignURL is a valid URL string or null (never omitted entirely)
[ ] uiInteractions is a list or null (never omitted entirely)
[ ] responsiveBreakpoints is a string or null (never omitted entirely)
[ ] claudeDesignURL is non-null if type is frontend or fullstack
[ ] claudeDesignURL is null if type is backend
[ ] graphqlChanges is exactly true or false (never omitted)
[ ] affectedSubgraphs present if graphqlChanges: true, absent if graphqlChanges: false
[ ] affectedSubgraphs values match ./servers/[domain]-subgraph/ folders
[ ] integrationTestPlan present with at least one scenario
[ ] Each integration scenario has: id, scenario
[ ] No PENDING markers remain anywhere in the document
```

**Cross-field checks**
```
[ ] All FEAT, US, E2E, INT ids are sequential and unique across the document
[ ] Release-level affectedSubgraphs equals union of all feature-level affectedSubgraphs
```

### Step 3 — Validate [domain]-subgraph.api.graphql files

For each attached `.graphql` file:
```
[ ] Filename matches format [domain]-subgraph.api.graphql
[ ] Domain name matches a folder in ./servers/[domain]-subgraph/
[ ] File contains required header comment block
[ ] File contains extend schema @link block with federation v2 URL
[ ] @link import includes at minimum: @key, @external
[ ] Every new type has a triple-quote docstring
[ ] Every new field and argument has a triple-quote docstring
[ ] Owning subgraph: entity type has @key(fields: "id") without @external on own fields
[ ] Referencing subgraphs: stub has @key(fields: "id") and @external on all declared fields
[ ] Comment "# Owned by [domain]-subgraph" appears above all stub types
[ ] File contains only additions/changes for this release — no unchanged existing schema
[ ] No composed supergraph content included
[ ] A .graphql file exists for every subgraph listed in every feature's affectedSubgraphs
```

### Step 4 — Report validation results

If all checks pass:
```
OpenSpec validation passed
Release: [version]
Type: [release | hotfix]
User stories: [n], Features: [n], GraphQL SDL files: [n]
PENDING items: none
Proceeding to write files to .openspec/
```

If any checks fail, list every failure with field path and reason. For example:
```
OpenSpec validation failed — [n] issue(s) found
- features[1].claudeDesignURL: null but type is fullstack — URL required
- features[2].affectedSubgraphs: billing-subgraph not found in ./servers/
- auth-subgraph.api.graphql: missing docstring on type SSOLoginResponse
- PENDING marker found in features[3].claudeDesignURL
Please fix the above in the source files and re-attach to a new session.
```

Stop here if any validation fails. Do not write files or proceed until all issues are resolved.

### Step 5 — Write validated files to .openspec/

Once validation passes:

```bash
# For release
mkdir -p .openspec/requirements/release/[version]

# For hotfix
mkdir -p .openspec/requirements/hotfix/[version]

# Write requirements.yaml and all .graphql files to the correct folder
```

### Step 6 — Commit OpenSpec files

```bash
git checkout release/[version]   # or hotfix/[version]-[desc] for hotfix
git pull origin [branch]
git add .openspec/
git commit -m "chore(openspec): add requirements for [version]"
git push origin [branch]
```

If the release branch does not exist:
```
/blocked
Role: pm
Issue: Release branch release/[version] does not exist
Waiting for: Developer to create the release branch from main, then re-run this session
```

### Step 7 — Confirm and continue

```
OpenSpec committed to .openspec/requirements/[release|hotfix]/[version]/
Proceeding with /pm Phase 1 onwards.
```

---

## Phase 1 — Read Inputs

```
1. Read .openspec/requirements/[release|hotfix]/[version]/requirements.yaml
2. Identify all user stories (or bugs), features, and graphqlChanges flags
3. Confirm release version and branch name from the yaml header
4. Derive affected subgraph names from ./servers/ folder structure
5. Do not proceed if any user story is missing acceptance criteria or features
```

---

## Phase 2 — Generate OpenSpec Files

This phase is skipped when OpenSpec files were committed in Phase 0.
Only execute Phase 2 when Claude Code is generating content itself — for example
during a verbal hotfix session where the developer described bugs in the session
rather than attaching files from a Claude.ai chat.

### Step 1 — Create release folder
```bash
mkdir -p .openspec/requirements/release/[version]
```

### Step 2 — Write requirements.yaml

Write `.openspec/requirements/release/[version]/requirements.yaml` following this schema exactly:

```yaml
---
release: [version]
date: [YYYY-MM-DD]
releaseBranch: release/[version]

affectedSubgraphs:           # list all subgraphs touched across all features
  - [domain]-subgraph

userStories:
  - id: US-[n]
    title: [title]
    persona: [persona]
    goal: [goal]
    outcome: [outcome]
    labels:
      - user-story
      - e2e                  # include if any feature is frontend or fullstack
    acceptanceCriteria:
      - [criterion]
    e2eTestPlan:
      - id: E2E-[n]
        scenario: [scenario]
        given: [given]
        when: [when]
        then: [then]
    features:
      - id: FEAT-[n]
        title: [title]
        type: backend | frontend | fullstack
        description: [description]
        component: [domain]-subgraph.[Service].[Method] or ComponentName
        input: [input description]
        output: [output description]
        edgeCases:
          - [edge case]
        claudeDesignURL: [url or null]
        uiInteractions: [list or null]
        responsiveBreakpoints: [breakpoints or null]
        graphqlChanges: true | false
        affectedSubgraphs:   # only if graphqlChanges: true
          - [domain]-subgraph
        integrationTestPlan:
          - id: INT-[n]-[n]
            scenario: [scenario]
```

Rules:
- `affectedSubgraphs` at release level = union of all feature-level `affectedSubgraphs`
- `claudeDesignURL` must be `null` for backend features, never omitted
- `uiInteractions` and `responsiveBreakpoints` must be `null` for backend features
- `graphqlChanges: false` features must not have `affectedSubgraphs`
- IDs must be sequential and unique across the document

### Step 3 — Write GraphQL SDL files (if any feature has graphqlChanges: true)

For each subgraph in the release-level `affectedSubgraphs`:

Write `.openspec/requirements/release/[version]/[domain]-subgraph.api.graphql` following these rules:

**Header (required on every file)**
```graphql
# Apollo Federation v2 SDL — [domain]-subgraph
# Release: [version]
# Feature references: [FEAT-ids that affect this subgraph]
#
# This file contains ONLY the schema additions/changes for this release.
# Implementation target: ./servers/[domain]-subgraph/src/schema/
```

**Federation link (required on every file)**
```graphql
extend schema
  @link(url: "https://specs.apollo.dev/federation/v2.0", import: [
    "@key",
    "@shareable",
    "@external",
    "@requires",
    "@provides",
    "@override",
    "@inaccessible"
  ])
```

**Ownership rules**
- The subgraph that owns an entity declares it with `@key(fields: "id")`
- Subgraphs that reference but do not own an entity declare a stub with `@key(fields: "id")` and `@external` on all fields
- Only declare `@external` fields that the referencing subgraph actually uses
- Always add a comment above stubs: `# Owned by [domain]-subgraph`

**What to include**
- New types, enums, scalars introduced in this release
- New queries and mutations introduced in this release
- Modified fields on existing types (include only the modified type with a comment noting what changed)
- Cross-subgraph entity stubs where referenced

**What NOT to include**
- Existing schema that is unchanged
- The full composed supergraph
- Apollo Router configuration

### Step 4 — Commit OpenSpec files
```bash
git checkout release/[version]
git add .openspec/requirements/release/[version]/
git commit -m "chore(openspec): add requirements for release [version]"
git push origin release/[version]
```

---

## Phase 3 — Ensure Labels Exist

Check existing labels first:
```bash
gh label list
```

Required labels and their colours:

| Label | Colour | Description |
|---|---|---|
| `user-story` | `#0075ca` | Main user story issue |
| `feature` | `#e4e669` | Feature sub-issue |
| `backend` | `#d93f0b` | Backend feature |
| `frontend` | `#0052cc` | Frontend feature |
| `fullstack` | `#6f42c1` | Fullstack feature |
| `e2e` | `#00b5ad` | Relates to e2e testing |
| `bug` | `#d73a4a` | Something is not working |
| `bugfix` | `#e99695` | Fix for a bug found in CI |
| `hotfix` | `#b60205` | Production hotfix |
| `production-bug` | `#e4e669` | Bug found in production |
| `release/[version]` | `#bfd4f2` | Scoped to this release |

Create any missing label:
```bash
gh label create "user-story" --color "0075ca" --description "Main user story issue"
gh label create "feature" --color "e4e669" --description "Feature sub-issue"
gh label create "backend" --color "d93f0b" --description "Backend feature"
gh label create "frontend" --color "0052cc" --description "Frontend feature"
gh label create "fullstack" --color "6f42c1" --description "Fullstack feature"
gh label create "e2e" --color "00b5ad" --description "Relates to e2e testing"
gh label create "bug" --color "d73a4a" --description "Something is not working"
gh label create "bugfix" --color "e99695" --description "Fix for a bug found in CI"
gh label create "hotfix" --color "b60205" --description "Production hotfix"
gh label create "production-bug" --color "e4e669" --description "Bug found in production"
gh label create "release/[version]" --color "bfd4f2" --description "Release [version]"
```

Only create labels that are missing — do not overwrite existing ones.

---

## Phase 4 — Create Release Milestone

```bash
gh api repos/:owner/:repo/milestones | jq '.[].title'

gh api repos/:owner/:repo/milestones \
  --method POST \
  --field title="[version]" \
  --field description="Release [version]" \
  --field due_on="[YYYY-MM-DDT00:00:00Z or omit]"
```

Note the milestone number returned.

---

## Phase 5 — Create GitHub Issues

Read from `.openspec/requirements/release/[version]/requirements.yaml` for all values.

### For each userStory:

**Step 1 — Create user story issue**
```bash
gh issue create \
  --title "[US] [title from requirements.yaml]" \
  --body "[user story template below]" \
  --label "user-story" \
  --label "release/[version]" \
  --label "e2e" \              # only if labels includes e2e in requirements.yaml
  --milestone "[version]"
```

User story issue template:
```markdown
## User Story
As a [persona], I want to [goal] so that [outcome].

## Acceptance Criteria
- [ ] [criterion from requirements.yaml]

## e2e Test Plan
- [E2E-n] [scenario]: Given [given] / When [when] / Then [then]

## Sub-Issues
[updated after sub-issues are created]

## OpenSpec
`.openspec/requirements/release/[version]/requirements.yaml` — [US-n]

## Branches
- User story branch: `us/[issue-number]-[short-title]`

## Status
Closes when all sub-issues are closed.
```

**Step 2 — Create feature sub-issues**
```bash
gh issue create \
  --title "[FEAT] [title from requirements.yaml]" \
  --body "[feature template below]" \
  --label "feature" \
  --label "release/[version]" \
  --label "[backend|frontend|fullstack]" \
  --milestone "[version]"
```

Feature sub-issue template:
```markdown
## Feature Description
[description from requirements.yaml]

## Technical Spec
- Component: [component from requirements.yaml]
- Type: [type]
- Input: [input]
- Output: [output]
- Edge cases:
  - [edge case]

## GraphQL Schema Changes
[If graphqlChanges: true]
- Affected subgraphs: [list from requirements.yaml]
- Schema file(s): `.openspec/requirements/release/[version]/[domain]-subgraph.api.graphql`

[If graphqlChanges: false]
- No GraphQL schema changes in this feature

## UI Spec
[If frontend or fullstack]
- Claude Design URL: [claudeDesignURL from requirements.yaml]
- Interactions: [uiInteractions]
- Responsive breakpoints: [responsiveBreakpoints]

[If backend]
- N/A

## Integration Test Plan
- [INT-n-n] [scenario]

## OpenSpec
`.openspec/requirements/release/[version]/requirements.yaml` — [FEAT-n]

## Branches
- Feature branch: `feat/[issue-number]-[short-title]`
- Parent branch: `us/[parent-issue-number]-[parent-short-title]`

## Parent Issue
Part of #[user-story-issue-number]

## Definition of Done
- [ ] Integration tests written and passing
- [ ] SonarQube Quality Gate passed
- [ ] Self code review passed
- [ ] GraphQL schema implemented and Rover compose verified (if graphqlChanges: true)
- [ ] PR opened and linked to this issue
```

**Step 3 — Update user story Sub-Issues checklist**
```bash
gh issue edit [us-issue-number] --body "[updated body]"
```

---

## Phase 6 — Create Branches and Link to Issues

Branch naming rules:
- Short title: lowercase, hyphen-separated, max 5 words
- Strip `[US]` or `[FEAT]` prefix
- Always include issue number for GitHub auto-linking

### User story branches
```bash
git checkout release/[version]
git pull origin release/[version]
git checkout -b us/[issue-number]-[short-title]
git push -u origin us/[issue-number]-[short-title]
```

### Feature branches
```bash
git checkout us/[parent-issue-number]-[short-title]
git checkout -b feat/[issue-number]-[short-title]
git push -u origin feat/[issue-number]-[short-title]
```

### Verify or manually link branches to issues
```bash
gh issue view [issue-number] --json developmentBranches

# If not auto-linked:
gh api repos/:owner/:repo/issues/[issue-number]/branches \
  --method POST \
  --field branch="[branch-name]"
```

---

## Phase 7 — Verify Setup

```bash
# All issues with correct labels and milestone
gh issue list --milestone "[version]"

# Per issue: labels, milestone, branch links
gh issue view [issue-number] --json labels,milestone,title,developmentBranches

# All branches exist
git ls-remote --heads origin | grep -E "us/|feat/"
```

Fix any gaps before handing off.

---

## Phase 8 — Handoff to QA

Post on each user story issue:
```
/handoff qa
OpenSpec: .openspec/requirements/release/[version]/requirements.yaml
User story: US-[n]
User story branch: us/[number]-[title]
Feature branches: feat/[number]-[title], feat/[number]-[title]
GraphQL SDL: [domain]-subgraph.api.graphql, [domain]-subgraph.api.graphql (or "none")
Labels: ✅
Milestone: [version] ✅
Branch links: ✅
Status: OpenSpec and issues created. Ready for test authoring.
```

---

## Bugfix Flow

### Scenario A — CI fails on feature branch
Notify Dev directly — no new branch needed:
```
/handoff dev
Trigger: CI failure on feat/[number]-[title]
Failed: [integration tests | SonarQube | both]
Actions run: [link]
Status: Fix directly on feat/[number]-[title]. Re-push to re-trigger CI.
```

### Scenario B — CI fails on user story branch

**Create bugfix issue**
```bash
gh issue create \
  --title "[BUG] [short description of failure]" \
  --body "[bugfix issue template]" \
  --label "bug" \
  --label "bugfix" \
  --label "release/[version]" \
  --milestone "[version]"
```

Bugfix issue template:
```markdown
## Bug Description
[What is failing — include CI run link]

## Failing Checks
- [ ] Integration tests: [test names]
- [ ] SonarQube: [issues]

## Source Branch
`us/[issue-number]-[short-title]`

## Bugfix Branch
`bugfix/[us-issue-number]-[short-description]`

## Parent Issue
Part of #[user-story-issue-number]

## Definition of Done
- [ ] All CI checks passing
- [ ] SonarQube Quality Gate passed
- [ ] PR merged into user story branch
```

**Create bugfix branch from user story branch**
```bash
git checkout us/[us-issue-number]-[short-title]
git pull origin us/[us-issue-number]-[short-title]
git checkout -b bugfix/[us-issue-number]-[short-description]
git push -u origin bugfix/[us-issue-number]-[short-description]
```

Format: `bugfix/[us-issue-number]-[short-description]`
Example: `bugfix/42-auth-token-null-pointer`

**Link branch and update user story issue, then handoff to Dev**
```
/handoff dev
Bugfix branch: bugfix/[us-issue-number]-[short-description]
Bugfix issue: #[bugfix-issue-number]
Parent: us/[us-issue-number]-[short-title]
Failed checks: [list]
Actions run: [link]
Status: Fix on bugfix branch. Same quality gates apply. Open PR into us/[us-issue-number]-[short-title].
```

**Branch lifecycle**
```
bugfix/[us-issue-number]-[desc] → merged into us/ via PR
                                → kept until us/ merges into release/
                                → deleted after us/ PR is merged
```

---

## Hotfix Flow

Triggered by explicit developer instruction with current version and problem description.

### Subgraph naming in hotfix
Same convention applies: `[domain]-subgraph`. Derive from `./servers/` structure.

### Phase H1 — Generate Hotfix OpenSpec Files

Derive new patch version: `X.Y.Z` → `X.Y.(Z+1)`

```bash
mkdir -p .openspec/requirements/hotfix/[new-version]
```

Write `.openspec/requirements/hotfix/[new-version]/requirements.yaml`:
```yaml
---
release: [new-version]
date: [YYYY-MM-DD]
hotfix: true
hotfixBranch: hotfix/[new-version]-[short-description]
previousVersion: [X.Y.Z]
affectedSubgraphs:
  - [domain]-subgraph   # if any bug involves GraphQL changes

bugs:
  - id: BUG-1
    title: [specific bug title]
    userImpact: [how this blocks users]
    component: [domain]-subgraph.[Service].[Method] or ComponentName
    type: backend | frontend | fullstack
    rootCause: [hypothesis if known]
    expectedBehaviour: [what should happen]
    actualBehaviour: [what is happening]
    graphqlChanges: true | false
    affectedSubgraphs:   # only if graphqlChanges: true
      - [domain]-subgraph
    claudeDesignURL: null | [url]
    integrationTestPlan:
      - id: INT-BUG-1-1
        scenario: [scenario]
```

Write `[domain]-subgraph.api.graphql` if any bug has `graphqlChanges: true` — same format as release SDL files.

Commit:
```bash
git checkout main
git add .openspec/requirements/hotfix/[new-version]/
git commit -m "chore(openspec): add hotfix requirements for [new-version]"
git push origin main
```

### Phase H2 — Ensure Hotfix Labels Exist
```bash
gh label create "hotfix" --color "b60205" --description "Production hotfix"
gh label create "production-bug" --color "e4e669" --description "Bug found in production"
```

### Phase H3 — Create Hotfix Milestone
```bash
gh api repos/:owner/:repo/milestones \
  --method POST \
  --field title="hotfix/[new-version]" \
  --field description="Hotfix release [new-version] — production bug fixes"
```

### Phase H4 — Create Hotfix Issues

**Hotfix parent issue**
```bash
gh issue create \
  --title "[HOTFIX] [short description of production problem]" \
  --body "[hotfix parent template]" \
  --label "hotfix" \
  --label "production-bug" \
  --milestone "hotfix/[new-version]"
```

**Hotfix sub-issues (one per BUG-n in requirements.yaml)**
```bash
gh issue create \
  --title "[BUG] [specific bug title]" \
  --body "[hotfix sub-issue template]" \
  --label "hotfix" \
  --label "production-bug" \
  --label "[backend|frontend|fullstack]" \
  --milestone "hotfix/[new-version]"
```

Hotfix sub-issue template:
```markdown
## Bug Description
[actualBehaviour from requirements.yaml]

## User Impact
[userImpact from requirements.yaml]

## Technical Spec
- Component: [component]
- Root cause: [rootCause]
- Expected: [expectedBehaviour]
- Actual: [actualBehaviour]

## GraphQL Schema Changes
[Same format as feature sub-issue — include SDL reference if graphqlChanges: true]

## OpenSpec
`.openspec/requirements/hotfix/[new-version]/requirements.yaml` — [BUG-n]

## Bugfix Branch
`bugfix/[hotfix-sub-issue-number]-[short-description]`

## Parent Issue
Part of #[hotfix-issue-number]

## Definition of Done
- [ ] Bug fixed on bugfix branch
- [ ] Integration tests updated to cover the fix
- [ ] SonarQube Quality Gate passed
- [ ] GraphQL schema implemented and Rover compose verified (if applicable)
- [ ] PR merged into hotfix branch
```

### Phase H5 — Create Hotfix and Bugfix Branches

**Hotfix branch from main**
```bash
git checkout main
git pull origin main
git checkout -b hotfix/[new-version]-[short-description]
git push -u origin hotfix/[new-version]-[short-description]
```

Format: `hotfix/[new-version]-[short-description]`
Example: `hotfix/1.0.1-payment-gateway-crash`

**Bugfix branches from hotfix branch**
```bash
git checkout hotfix/[new-version]-[short-description]
git checkout -b bugfix/[hotfix-sub-issue-number]-[short-description]
git push -u origin bugfix/[hotfix-sub-issue-number]-[short-description]
```

Format: `bugfix/[hotfix-sub-issue-number]-[short-description]`
Example: `bugfix/88-null-token-on-checkout`

Link all branches to their issues — same auto-link + manual fallback as standard flow.

### Phase H6 — Verify and Handoff to QA

```bash
gh issue list --milestone "hotfix/[new-version]"
git ls-remote --heads origin | grep -E "hotfix/|bugfix/"
```

Post on hotfix parent issue:
```
/handoff qa
Mode: HOTFIX
OpenSpec: .openspec/requirements/hotfix/[new-version]/requirements.yaml
Hotfix branch: hotfix/[new-version]-[short-description]
Bugfix branches: bugfix/[number]-[desc], bugfix/[number]-[desc]
GraphQL SDL: [domain]-subgraph.api.graphql (or "none")
Milestone: hotfix/[new-version] ✅
Labels: ✅
Branch links: ✅
Status: Treat bugfix branches as feature branches, hotfix branch as user story branch. Full QA and DevOps flow applies. Version bump X.Y.Z → [new-version] by developer on merge to main.
```

---

## Branch Lifecycle Summary

| Branch type | Created from | Merged into | Deleted after |
|---|---|---|---|
| `release/` | `main` | `main` (developer) | Never — kept as release tag |
| `us/` | `release/` | `release/` | `us/` PR merged |
| `feat/` | `us/` | `us/` | `feat/` PR merged |
| `bugfix/` (release) | `us/` | `us/` | `us/` PR merged into `release/` |
| `hotfix/` | `main` | `main` | Hotfix PR merged |
| `bugfix/` (hotfix) | `hotfix/` | `hotfix/` | Hotfix PR merged into `main` |

---

## Stopping Conditions

Post a `/blocked` comment and stop if:
- Release branch does not exist
- `./servers/` folder does not exist — cannot derive subgraph names
- Any user story is missing acceptance criteria
- Any feature with `graphqlChanges: true` has no `affectedSubgraphs` listed
- Any frontend/fullstack feature is missing a `claudeDesignURL`
- GitHub CLI authentication fails
- Branch-to-issue linking fails after manual attempt