# Architecture Decision Record

## Purpose
Documents significant technical decisions made during planning so future agents and developers understand why decisions were made.

## Role
Solution Architect

## Phase
Planning (Stage 3) — triggered whenever a significant decision is made

## Triggered By
Significant tech decision during planning session.

## Inputs
- Decision context and options considered

## Significance Threshold
Create an ADR when ANY of the following is true:
- Choosing between two or more viable technologies
- Deviating from existing patterns in the codebase
- Making a decision that affects multiple services
- Establishing a new pattern that will be repeated
- Accepting known trade-offs for business reasons

## Process
1. Identify the decision meets the significance threshold.
2. Write context, options considered, decision, and consequences.
3. Commit draft to OpenSpec change folder.
4. Technical Writer publishes to `apps/docs/` when story ships.

## Outputs
- Draft: `openspec/changes/{slug}/adr-{N}.md`
- Published: `apps/docs/src/content/internal/latest/architecture/decisions/`

Format:
```
# ADR-{N}: {Short Title}
# Date: {date}
# Status: Proposed | Accepted | Deprecated | Superseded

## Context
{what problem required a decision}

## Options Considered
### Option A: {name}
{description + trade-offs}

### Option B: {name}
{description + trade-offs}

## Decision
{which option was chosen and why}

## Consequences
{what changes as a result — positive and negative}

## Related Decisions
{links to related ADRs if any}
```

## Quality Gates
- [ ] Context clearly explains why a decision was needed
- [ ] At least 2 options considered with trade-offs
- [ ] Decision rationale explicitly stated
- [ ] Consequences documented (both positive and negative)

## References
- `.claude/skills/technical-writer/` (publishing)
