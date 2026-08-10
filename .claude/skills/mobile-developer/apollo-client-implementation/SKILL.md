# Apollo Client Implementation

## Purpose
Configures Apollo Client to communicate with SIT Apollo Router and consumes generated GraphQL types.

## Role
Mobile Developer

## Phase
Development

## Triggered By
New mobile app needs API integration.

## Inputs
- `EXPO_PUBLIC_API_URL` environment variable
- Generated types from `packages/api/src/generated/{service}/graphql/`

## Process
Identical to frontend — Apollo Client → SIT Apollo Router. Generated types from `packages/api/src/generated/{service}/graphql/`. Configured in `shared/libs/apolloClient.ts` within the mobile app.

## Outputs
Configured Apollo Client instance in `shared/libs/apolloClient.ts`.

## Quality Gates
- [ ] Client configured in shared/libs/apolloClient.ts
- [ ] URI from EXPO_PUBLIC_API_URL (not hardcoded)
- [ ] Generated types used (not hand-written interfaces)
- [ ] Cache policies appropriate per operation type

## References
- `.claude/skills/frontend-developer/apollo-client-implementation/SKILL.md`
- `.claude/skills/mobile-developer/environment-configuration/SKILL.md`
