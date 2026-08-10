# Compliance Assessment

## Purpose
Identifies applicable compliance frameworks for a story and produces concrete testable compliance requirements.

## Role
Security Engineer

## Phase
Planning (Stage 2)

## Triggered By
`threat-modelling` and `security-story-review` complete.

## Inputs
- Story data types and domains touched

## Override Rule
Compliance requirements bypass `priority-scoring-model`. They are non-negotiable Must Ship. Story does not ship if compliance cannot fit.

## Compliance Triggers (check each for this story)
- Personal data/PII → GDPR, PDPA (Malaysia)
- Healthcare data → HIPAA, HL7 FHIR security
- Payment/financial → PCI-DSS
- Enterprise/B2B → SOC 2, ISO 27001
- Authentication flows → NIST 800-63
- API security → OWASP API Security
- Cryptography → FIPS 140-2, TLS 1.3

## Process
1. Identify which domains this story touches based on data types.
2. For each applicable framework, produce specific testable requirements (NOT vague references — specific controls that can be tested).
3. Format requirements as AC: Given/When/Then.
4. Add compliance requirements to PRD compliance section.
5. Flag to PM: these are Must Ship, bypass scoring.
6. If compliance conflicts with functional requirement: escalate to Edward.

## Outputs
Compliance requirements in PRD, flagged Must Ship.

## Quality Gates
- [ ] All applicable domains identified
- [ ] Requirements are specific and testable (not vague)
- [ ] Compliance requirements clearly marked Must Ship in PRD
- [ ] Conflicts escalated to Edward

## References
- `.claude/skills/security-engineer/threat-modelling/SKILL.md`
- `.claude/skills/shared/priority-scoring-model/SKILL.md`
- `.claude/skills/shared/escalation-to-owner/SKILL.md`
