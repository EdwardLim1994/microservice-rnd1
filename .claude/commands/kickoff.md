# /kickoff v{X}.{Y}.{Z}

## Purpose
Edward's approval to start the sprint — creates all branches, empty PRs, and assigns roles to begin development.

## Triggered By
Edward (after reviewing sprint plan from `/start`).

## Pre-checks
DoR gate — ALL must pass or execution blocked. For each story in sprint:
- ✓ Acceptance criteria written (not empty)
- ✓ Dependencies mapped (`openspec/changes/{slug}/dependency-graph.md` exists)
- ✓ API contract referenced (`contracts/` path in PRD)
- ✓ Security sign-off label present (`security: cleared` or `conditional`)
- ✓ No unresolved escalations

If any story fails DoR → show specific failures → block execution. Resolve failures then re-run `/kickoff`.

## Steps
1. Create `release/v{X}.{Y}.{Z}` from `main`.
2. Per story: create `us/{KAN-N}-{description}` from `release/`.
3. Per feature: create `feat/{KAN-N}-{description}` from `us/`.
4. Per feature: create `api/{KAN-N}` from `feat/` (Data Engineer).
5. Per feature: create `qa/{KAN-N}` from `feat/` (QA Engineer).
6. Per task: create `task/{KAN-N}` from `feat/`.
7. Story-level: create `security/{KAN-N}` from `us/` (if story has security config).
8. Story-level: create `devops/{KAN-N}` from `us/` (if story has infra changes).
9. Release-level: create `devops/{KAN-N}` from `release/` (if pipeline changes).
10. Create empty PRs for ALL branches.
11. Assign kanban cards to appropriate roles.
12. Notify all subagents: sprint v{X}.{Y}.{Z} has started.

## Output
- N stories, N features, N tasks, N branches created
- All empty PRs created
- Sprint milestone active in kanban
- Subagents assigned and notified

## On Failure
- Any DoR item failing blocks execution entirely; no partial branch creation.

## References
- `.claude/skills/pm/sprint-planning/SKILL.md`
- `.claude/skills/pm/milestone-management/SKILL.md`
- `.claude/skills/release-manager/release-branch-management/SKILL.md`
