# GraphQL Schema Design

## Purpose
Defines or modifies GraphQL SDL schemas in `contracts/graphql/` for Apollo Federation v2 subgraphs.

## Role
Solution Architect

## Phase
Planning (Stage 3)

## Triggered By
New or modified `*-subgraph` identified in `technical-assessment`.

## Inputs
- `service-boundary-definition` output for the affected subgraph

## Location
`contracts/graphql/{service-name}/` — Architect raises PR. Data Engineer reviews for compatibility.

## Conventions
- Apollo Federation v2 directives: `@key`, `@external`, `@requires`, `@provides`
- PascalCase types, camelCase fields
- Never expose internal gRPC errors directly to clients
- Error responses use union types or error interface
- Every mutation returns a Result type (success + possible errors)
- Run `bun run supergraph` after every SDL change

### Anti-Pattern
Never define SDL inside a service directory. Services reference `contracts/graphql/` only. Generated types: `packages/api/src/generated/{service}/graphql/` — NEVER edit.

## Process
1. Design SDL based on `service-boundary-definition`.
2. Write SDL to `contracts/graphql/{service-name}/`.
3. Raise PR: branch `api/{KAN-N}` from `feat/{KAN-N}`.
4. Request Data Engineer review.
5. After approval: Data Engineer runs `api-type-generation`.
6. Run `bun run supergraph` to verify federation composes correctly.

## Outputs
GraphQL SDL PR on `api/{KAN-N}` branch, composed supergraph verified.

## Quality Gates
- [ ] Federation v2 directives used correctly
- [ ] Error handling via result types (not thrown errors)
- [ ] bun run supergraph passes after SDL change
- [ ] Data Engineer reviewed for compatibility

## References
- `.claude/skills/solution-architect/service-boundary-definition/SKILL.md`
- Data Engineer `api-type-generation`
- `bun run supergraph` (CLAUDE.md)
