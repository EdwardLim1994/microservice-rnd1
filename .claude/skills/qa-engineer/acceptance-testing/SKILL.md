# Acceptance Testing

## Purpose
Tests each story against its AC using test cases designed during planning, run against the UAT environment.

## Role
QA Engineer

## Phase
UAT (per story)

## Triggered By
`uat-deployment-verification` confirms environment ready.

## Inputs
- Test cases from `integration-test-case-design` and `e2e-test-case-design`

## Process
1. Run automated test suites (integration + e2e) against the UAT environment.
2. Test in parallel with PO `story-acceptance-testing` — do not block each other.
3. Bug found → create kanban card: `type: bug-story`, appropriate `area` label.
4. External-facing bugs also filed in external issue tracker.
5. All AC pass → add label `qa: uat-approved` to story PR.

BOTH `qa: uat-approved` AND `po: uat-approved` required before story can merge.

## Outputs
`qa: uat-approved` label, or bug cards.

## Quality Gates
- [ ] All AC tested against UAT environment
- [ ] Bugs filed with correct type/area
- [ ] qa: uat-approved applied only when all AC pass
- [ ] External-facing bugs also filed externally

## References
- `.claude/skills/po/story-acceptance-testing/SKILL.md`
- `.claude/skills/qa-engineer/uat-deployment-verification/SKILL.md`
- `.claude/skills/qa-engineer/bug-severity-triage/SKILL.md`
