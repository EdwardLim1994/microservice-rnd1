# Role SOP — Project Management (`/pm`)

## Responsibility
Create GitHub issues and branches from the requirements document. Signal QA when ready.

## Prerequisites (verify before acting)
```
[ ] CLAUDE.md has been read
[ ] Release branch exists (git ls-remote --heads origin release/[release-name])
[ ] Requirements document exists at .claude/requirements/[release-name].md
[ ] GitHub CLI is authenticated (gh auth status)
```

If any prerequisite fails — post a `/blocked` comment on the release milestone and stop.

---

## Phase 1 — Read Inputs

```
1. Read .claude/requirements/[release-name].md
2. Identify all user stories and their features
3. Confirm release branch name from the requirements document header
4. Do not proceed if any user story is missing acceptance criteria or features
```

---

## Phase 2 — Create GitHub Issues

### For each user story:

**Step 1 — Create user story issue**
```
Title:  [US] [Title from requirements document]
Body:   Use user story issue template below
Labels: user-story, release/[release-name]
```

User story issue template:
```markdown
## User Story
As a [persona], I want to [goal] so that [outcome].

## Acceptance Criteria
- [ ] [criterion from requirements document]
- [ ] [criterion from requirements document]

## e2e Test Plan (Playwright)
- [scenario from requirements document]
- [scenario from requirements document]

## Sub-Issues
[to be updated after sub-issues are created]

## Notes
Requirements document: `.claude/requirements/[release-name].md`

## Status
Closes when all sub-issues are closed.
```

**Step 2 — Create feature sub-issues**

For each feature under the user story:
```
Title:  [FEAT] [Title from requirements document]
Body:   Use feature sub-issue template below
Labels: feature, release/[release-name]
Parent: link to user story issue
```

Feature sub-issue template:
```markdown
## Feature Description
[Description from requirements document]

## Technical Spec
- Endpoint / Component: [from requirements document]
- Type: [backend | frontend | fullstack]
- Input: [from requirements document]
- Output: [from requirements document]
- Edge cases: [from requirements document]

## UI Spec (Frontend / Fullstack only)
- Claude Design URL: [from requirements document — omit section if backend]
- Interactions: [from requirements document]
- Responsive breakpoints: [from requirements document]

## Integration Test Plan
[scenarios from requirements document]

## Definition of Done
- [ ] Integration tests written and passing
- [ ] SonarQube Quality Gate passed
- [ ] Self code review passed
- [ ] PR opened and linked to this issue
```

**Step 3 — Update user story issue sub-issue checklist**
```
Edit the user story issue body to add:
## Sub-Issues
- [ ] #[feat-issue-number] [FEAT] Feature title
- [ ] #[feat-issue-number] [FEAT] Feature title
```

---

## Phase 3 — Create Branches

### For each user story issue:
```
1. git checkout release/[release-name]
2. git pull origin release/[release-name]
3. git checkout -b us/[issue-number]-[short-title]
4. git push -u origin us/[issue-number]-[short-title]
```

### For each feature sub-issue:
```
1. git checkout us/[issue-number]-[short-title]
2. git checkout -b feat/[issue-number]-[short-title]
3. git push -u origin feat/[issue-number]-[short-title]
```

Branch naming rules:
- Short title: lowercase, hyphen-separated, max 5 words
- Derived from issue title — strip `[US]` or `[FEAT]` prefix

---

## Phase 4 — Handoff to QA

Post the following comment on each user story issue:
```
/handoff qa
User story branch: us/[number]-[title]
Feature branches: feat/[number]-[title], feat/[number]-[title]
Requirements: .claude/requirements/[release-name].md
Status: Issues and branches created. Ready for test authoring.
```

---

## Stopping Conditions

Post a `/blocked` comment and stop if:
- Release branch does not exist
- Requirements document is missing or has empty user stories
- Any user story is missing acceptance criteria
- Any feature is missing a technical spec
- Any frontend/fullstack feature is missing a Claude Design URL (flag it, do not block other features)
- GitHub CLI authentication fails