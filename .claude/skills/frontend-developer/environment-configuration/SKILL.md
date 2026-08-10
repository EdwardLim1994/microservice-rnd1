# Environment Configuration

## Purpose
Configures environment variables for frontend local development pointing at SIT Apollo Router.

## Role
Frontend Developer

## Phase
Development

## Triggered By
New webapp scaffolded or environment changes.

## Inputs
- SIT Apollo Router and Authentik URLs

## Process
Configure `.env.local` (NEVER commit):
```
RSBUILD_PUBLIC_API_URL=https://{SIT_APOLLO_ROUTER_HOST}
RSBUILD_PUBLIC_AUTHENTIK_URL=https://{SIT_AUTHENTIK_HOST}
RSBUILD_PUBLIC_APP_ENV=local
```

Configure `.env.example` (ALWAYS commit with placeholders):
```
RSBUILD_PUBLIC_API_URL=https://api.sit.internal
RSBUILD_PUBLIC_AUTHENTIK_URL=https://auth.sit.internal
RSBUILD_PUBLIC_APP_ENV=local
```

`RSBUILD_PUBLIC_*` prefix: only these variables are exposed to the browser. All other variables stay server-side only. NEVER hardcode URLs in component or hook code. All API access goes through `RSBUILD_PUBLIC_API_URL` → Apollo Router.

## Outputs
`.env.local` (gitignored) and `.env.example` (committed) for the webapp.

## Quality Gates
- [ ] .env.local gitignored and correctly configured
- [ ] .env.example committed with placeholder values
- [ ] No hardcoded API URLs in source code

## References
- `.claude/skills/frontend-developer/webapp-scaffolding/SKILL.md`
- `.claude/skills/frontend-developer/apollo-client-implementation/SKILL.md`
