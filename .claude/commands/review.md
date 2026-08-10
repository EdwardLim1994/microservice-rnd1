# /review KAN-{N}

## Purpose
Tech Lead code review for a specific PR.

## Triggered By
PR raised and ready for review, linked to kanban card KAN-{N}.

## Pre-checks
- PR associated with KAN-{N} exists and is open.

## Steps
1. Read PR associated with KAN-{N} kanban card.
2. Invoke Tech Lead `code-review` + `definition-of-done-enforcement`.

## Output
Review comments posted, approval or block decision recorded on the PR.

## On Failure
If DoD checklist fails: PR blocked with specific failing items listed, code-review does not proceed until resolved.

## References
- `.claude/skills/tech-lead/code-review/SKILL.md`
- `.claude/skills/tech-lead/definition-of-done-enforcement/SKILL.md`
