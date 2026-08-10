# /start "{feature description}"

## Purpose
Official SDLC entry point — converts a raw idea into a full planning session with Epic, Stories, tasks, and sprint plan.

## Triggered By
Edward (the only way to start the SDLC cycle).

Multiple `/start` calls before `/kickoff` accumulate stories for the same sprint.

## Pre-checks
Check if active sprint exists:
- Yes: "Active sprint v{X}.{Y}.{Z} exists. Add this feature to current sprint? (y/n)"
- No: "No active sprint. Starting planning for next available version."

## Steps
1. PO: `requirements-elicitation` (asks Edward clarifying questions, confirms Problem Statement).
2. PO: `epic-and-story-writing` (creates Epic + Story kanban cards).
3. PM: `planning-session-kickoff` (loads all roles with story context).
4. All planning roles: 7-stage planning session, Stage 1-7 in strict order (see PM `planning-session-facilitation` skill).
5. PM: `sprint-planning` + `milestone-management` (produces sprint plan for Edward's review).

## Output
- Epic created: KAN-{N}
- Stories created: KAN-{N+1}...
- Tasks created in kanban from OpenSpec `tasks.md`
- Sprint plan summary with Must Ship / Should Ship / Can Hold classification
- Signal: "Planning complete. Review sprint plan then run /kickoff v{X}.{Y}.{Z}"

## On Failure
- If Edward doesn't confirm Problem Statement: restart `requirements-elicitation`.
- If planning session escalation occurs: pause, surface to Edward via escalation document.

## References
- `.claude/skills/po/requirements-elicitation/SKILL.md`
- `.claude/skills/po/epic-and-story-writing/SKILL.md`
- `.claude/skills/pm/planning-session-kickoff/SKILL.md`
- `.claude/skills/pm/planning-session-facilitation/SKILL.md`
- `.claude/skills/pm/sprint-planning/SKILL.md`
