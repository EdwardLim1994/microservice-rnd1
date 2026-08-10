# UAT Sign-Off

## Purpose
Produces per-story UAT sign-off once all required approvals and checks are satisfied.

## Role
QA Engineer

## Phase
UAT

## Triggered By
`acceptance-testing`, PO `story-acceptance-testing`, and `compliance-code-review` all complete for the story.

## Inputs
- `qa: uat-approved` label status
- `po: uat-approved` label status
- `security: cleared` label status
- Open bug cards for the story

## Process
Produce sign-off when ALL of these are true:
- All story AC verified: `qa: uat-approved` label applied
- PO business logic verified: `po: uat-approved` label applied
- Security cleared: `security: cleared` label applied
- No open critical/high bug cards for this story

Signal PM: story ready for `/approve-story` command (Edward's approval).

## Outputs
UAT sign-off signal to PM.

## Quality Gates
- [ ] All three approval labels present
- [ ] No open critical/high bugs remain
- [ ] PM signalled for /approve-story

## References
- `.claude/skills/qa-engineer/acceptance-testing/SKILL.md`
- `.claude/skills/po/story-acceptance-testing/SKILL.md`
- `.claude/skills/security-engineer/compliance-code-review/SKILL.md`
