# /plan KAN-{N}

## Purpose
Planning session for an EXISTING kanban card — used when the Epic/Story already exists (retro improvement action, pre-existing request).

## Triggered By
Edward or PM, for a card that already exists but hasn't gone through planning.

## Pre-checks
- Kanban card KAN-{N} exists and is type `epic` or `story`.

## Steps
1. Invoke PM `planning-session-kickoff` for the specified card.
2. Invoke PM `planning-session-facilitation` — runs the full 7-stage planning session.

## Output
Same outputs as `/start`: technical assessment, PRD, OpenSpec change folder, kanban tasks, sprint-ready plan for the card.

## On Failure
If the card is not type epic/story, or lacks a Problem Statement: block and request PO `requirements-elicitation` first.

## References
- `.claude/skills/pm/planning-session-kickoff/SKILL.md`
- `.claude/skills/pm/planning-session-facilitation/SKILL.md`
