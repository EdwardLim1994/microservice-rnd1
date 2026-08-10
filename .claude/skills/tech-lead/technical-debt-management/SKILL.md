# Technical Debt Management

## Purpose
Identifies, decides, and tracks technical debt discovered during development without letting it silently accumulate.

## Role
Tech Lead

## Phase
Development (triggered during code-review)

## Triggered By
Tech Lead identifies technical debt during PR review.

## Inputs
- PR diff under review

## Default Behaviour
Address now. Exception: log for later — requires explicit justification.

### Decision Criteria for "Address Now"
- Debt is in code being modified (fix while there)
- Debt creates immediate risk (security, data integrity)
- Debt is small enough to fix within current PR or a quick follow-up PR

### Decision Criteria for "Log for Later"
- Debt is significant refactor (multi-sprint effort)
- Debt is in code unrelated to current story (scope risk)
- Team has explicitly accepted this debt pattern

## Process
1. Identify technical debt during code review.
2. Decide: address now or log for later.
3. If address now:
   a. Leave specific comment in PR: "This section has tech debt — please fix before merging"
   b. Describe the specific debt and how to address it
   c. PR cannot merge until addressed
4. If log for later:
   a. Create kanban card: `type: tech-debt`
   b. Title: `[Tech Debt] {specific description}`
   c. Body: where the debt is, why it's debt, how to address it, why deferred
   d. Priority: based on risk
   e. Leave comment in PR code referencing the kanban card number

## Outputs
PR fixed in place, or kanban tech-debt card created and linked.

## Quality Gates
- [ ] No tech debt silently ignored
- [ ] Deferred debt has a kanban card (not just a comment)
- [ ] "Address now" cases resolved before PR merges

## References
- `.claude/skills/tech-lead/code-review/SKILL.md`
- `.claude/skills/pm/kanban-board-management/SKILL.md`
