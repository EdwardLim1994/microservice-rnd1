# PRD Writing

## Purpose
Synthesises Stage 1-4 planning outputs into a structured PRD that serves as the technical requirements document for development.

## Role
Project Manager

## Phase
Planning (Stage 5)

## Triggered By
Stages 1-4 complete.

## Inputs
- Stage 1-4 outputs (story presentation, challenge round, technical assessment, UX elaboration)

## Process
Draft the PRD covering all required sections (see Outputs), pulling directly from each stage's artifacts. Circulate for sign-off from all roles before Stage 6.

## Outputs
Location: `openspec/changes/{slug}/prd.md`

PRD Sections (all required):
1. Problem Statement (from PO `requirements-elicitation`)
2. User Stories (links to kanban cards)
3. Technical Requirements per Service:
   - Which services affected
   - What each service must do
   - API contract references (`contracts/` paths)
4. Data Model Implications:
   - Schema changes needed (`contracts/` paths)
   - Migration requirements
5. Platforms Involved (web/mobile/both)
6. Non-Functional Requirements:
   - Performance SLAs per endpoint type
   - Scalability considerations
7. Security Requirements (from `security-requirements-writing`)
8. Compliance Requirements (from `compliance-assessment`) — NOTE: Compliance requirements bypass priority scoring — Must Ship always
9. Performance SLAs:
   - GraphQL query p99 ≤ 500ms
   - GraphQL mutation p99 ≤ 1000ms
   - gRPC call p99 ≤ 200ms
   - Kafka consumer p99 ≤ 100ms
10. Test Data Requirements (from QA `test-data-strategy`)

## Quality Gates
- [ ] All 10 sections present
- [ ] All roles have reviewed and signed off
- [ ] Compliance requirements clearly marked Must Ship
- [ ] PRD committed to `openspec/changes/{slug}/prd.md`

## References
- `.claude/skills/pm/planning-session-facilitation/SKILL.md`
- `.claude/skills/pm/openspec-proposal/SKILL.md`
