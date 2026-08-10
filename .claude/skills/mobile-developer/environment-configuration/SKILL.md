# Environment Configuration

## Purpose
Configures environment variables for mobile local development pointing at SIT Apollo Router.

## Role
Mobile Developer

## Phase
Development

## Triggered By
New mobile app scaffolded or environment changes.

## Inputs
- SIT Apollo Router and Authentik URLs

## Process
Expo env convention (`EXPO_PUBLIC_*` for client-exposed variables).

`.env.local`:
```
EXPO_PUBLIC_API_URL={SIT_APOLLO_ROUTER_URL}
EXPO_PUBLIC_AUTHENTIK_URL={SIT_AUTHENTIK_URL}
EXPO_PUBLIC_APP_ENV=local
```

`.env.example` committed with placeholder values.

Same rule as frontend: NEVER hardcode URLs.

## Outputs
`.env.local` (gitignored) and `.env.example` (committed) for the mobile app.

## Quality Gates
- [ ] .env.local gitignored and correctly configured
- [ ] .env.example committed with placeholder values
- [ ] No hardcoded API URLs in source code

## References
- `.claude/skills/frontend-developer/environment-configuration/SKILL.md`
- `.claude/skills/mobile-developer/apollo-client-implementation/SKILL.md`
