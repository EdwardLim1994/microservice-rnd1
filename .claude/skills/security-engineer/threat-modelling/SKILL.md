# Threat Modelling

## Purpose
Identifies attack surfaces, trust boundaries, and threat scenarios introduced by a user story during Stage 2 of planning.

## Role
Security Engineer

## Phase
Planning (Stage 2)

## Triggered By
Stage 1 complete, PO has presented story.

## Inputs
- User story and AC
- `security-knowledge-base`

## Process

### Triage First — Determine Review Depth
- High surface area (auth, PII, payment, public endpoint): full review
- Medium surface area (internal service with user data): standard review
- Low surface area (internal read-only, no user data): light review

### Full Review Process
1. Read `security-knowledge-base` for relevant standards.
2. Identify attack surfaces this story introduces or modifies.
3. Map data flows: where does sensitive data travel?
4. Identify trust boundaries: who can access what?
5. Identify threat scenarios (use STRIDE or similar): Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation.
6. Check third-party dependencies involved (Authentik, Vault, Apicurio) for known vulnerabilities in `security-knowledge-base`.
7. Assign Security Risk score for `shared/priority-scoring-model`.
8. Document findings for PRD security requirements section.

## Outputs
Threat model findings for PRD security requirements, Security Risk score.

## Quality Gates
- [ ] Triage level determined and appropriate depth applied
- [ ] All attack surfaces identified
- [ ] Trust boundaries mapped
- [ ] Third-party dependencies checked
- [ ] Security Risk score assigned

## References
- `.claude/skills/security-engineer/security-knowledge-base/SKILL.md`
- `.claude/skills/shared/priority-scoring-model/SKILL.md`
- `.claude/skills/security-engineer/security-story-review/SKILL.md`
