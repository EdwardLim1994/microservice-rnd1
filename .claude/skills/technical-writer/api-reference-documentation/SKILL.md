# API Reference Documentation

## Purpose
Documents endpoint/resolver behaviour alongside the PR that introduces or changes it.

## Role
Technical Writer

## Phase
Development (alongside PR — triggered when PR touches `apps/servers/*`)

## Triggered By
PR touching `apps/servers/*`.

## Inputs
- Endpoint/resolver implementation (source material only)

## Rule
Writes ONLY to `apps/docs/`. Never writes to `openspec/` or `contracts/`.

## Process
Document per endpoint/resolver:
- Business purpose (plain English — what does this do?)
- Request fields: type, required/optional, valid values, examples
- Response fields: type, nullable, examples
- Error codes: code, meaning, when it occurs
- Authentication requirements
- Rate limiting (if applicable)

Structure: one file per service, one section per endpoint.

## Outputs
Location: `apps/docs/src/content/internal/latest/api-reference/`

## Quality Gates
- [ ] Business purpose documented in plain English
- [ ] Request and response fields fully documented
- [ ] Error codes and auth requirements documented
- [ ] One file per service, one section per endpoint

## References
- `.claude/skills/backend-developer/grpc-service-implementation/SKILL.md`
- `.claude/skills/backend-developer/graphql-subgraph-implementation/SKILL.md`
