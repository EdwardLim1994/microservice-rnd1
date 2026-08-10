# Code Review

## Purpose
Coordinates domain specialist reviews and provides cross-cutting quality elevation across all PRs regardless of domain.

## Role
Tech Lead

## Phase
Development

## Triggered By
Any PR raised in the sprint.

## Inputs
- PR description and diff
- Linked kanban card

## Process
1. Read PR description and linked kanban card.
2. Review code for cross-cutting concerns:
   - Better patterns (is there a cleaner way to achieve this?)
   - Performance concerns (will this scale? are there N+1 queries?)
   - Maintainability (is this readable and modifiable in 6 months?)
   - Convention compliance (does this follow CLAUDE.md conventions?)
3. Assign domain specialist reviewers based on PR content:
   - PR touches `contracts/`: Data Engineer reviews schema correctness
   - PR touches security-sensitive code: Security Engineer reviews
   - PR touches database queries: Data Engineer reviews efficiency
   - PR touches deployment config: DevOps Engineer reviews
   - PR has QA test coverage concerns: QA Engineer reviews
4. Wait for all assigned reviews.
5. Consolidate: if all pass + Tech Lead satisfied → approve.
6. If Tech Lead or any reviewer blocks → leave specific feedback.
7. Only approve when all concerns resolved.

### Veto Power
Tech Lead can block a PR even if all specialist reviews passed.
- CAN block: convention violations, performance concerns, better architectural approach available, maintainability issues.
- CANNOT block: personal style preferences without technical justification.
- Feedback must be specific and actionable — never vague ("this could be better").

## Outputs
PR approved, or blocked with specific actionable feedback.

## Quality Gates
- [ ] Cross-cutting concerns reviewed by Tech Lead
- [ ] Domain specialists assigned where applicable
- [ ] All feedback is specific and actionable
- [ ] Never approved with unresolved concerns

## References
- `.claude/skills/tech-lead/definition-of-done-enforcement/SKILL.md`
- `.claude/skills/tech-lead/technical-debt-management/SKILL.md`
