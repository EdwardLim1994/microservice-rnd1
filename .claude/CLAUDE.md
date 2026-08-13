<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

---

## SDLC Workflow Conventions

### GitHub Issue Flow
- Issues with label `status: ready` in the current active Milestone are the work queue
- Pick up an issue by: assigning yourself, moving to `In Progress` on the project board
- Only pick issues from the current sprint Milestone — never reach into backlog
- Labels follow the convention: `type:{epic|story|task|bug}`, `priority:{high|medium|low}`, `area:{backend|frontend|mobile|devops|security}`
- Close issues via PR body: include `Closes #N` — never close manually

### Pull Request Conventions
- One PR per issue — never combine unrelated issues
- PR description format:
  - **What:** one sentence summary
  - **Why:** links to the issue and acceptance criteria
  - **How:** brief implementation notes for reviewer
  - **Testing:** what was tested and how
- Move linked issue to `In Review` status immediately after raising PR
- NEVER merge a PR — merge authority belongs to the repository owner only
- If blocked: add label `status: blocked`, comment explaining the blocker

### Phase Gates

**Before starting development (Definition of Ready):**
Every issue must have before it is picked up:
- [ ] Acceptance criteria written in the issue body
- [ ] Dependencies on other issues noted (e.g. "Depends on #N")
- [ ] API contract reference linked (proto file or GraphQL schema)
- [ ] No unresolved questions or blockers

**Before raising a PR (Definition of Done):**
Every PR must satisfy before marking In Review:
- [ ] Unit tests written and passing
- [ ] Integration tests written where applicable
- [ ] `bun turbo lint` passes with no errors
- [ ] `bun turbo check` (TypeScript) passes with no errors
- [ ] No new files in `packages/api/src/generated/` edited manually
- [ ] Generated files regenerated if proto/graphql/prisma schema changed
- [ ] Local ZAP baseline scan run (`cd test/zap && docker compose run zap-baseline`)
- [ ] PR description completed in full

### Backend-First Sequencing
When a story involves both backend and frontend/mobile work:
1. Backend Developer implements and completes the gRPC service and GraphQL subgraph
2. `buf generate` and `graphql-codegen` run to regenerate typed contracts in `packages/api/`
3. `bun turbo supergraph` runs to recompose Apollo Router
4. PR raised for backend work and moved to In Review
5. Frontend/Mobile Developer begins integration ONLY after backend PR is merged
6. This sequencing is enforced — frontend must not begin integration against unmerged backend

### Scaffolding Rules
- NEVER manually create a new server, web app, or MFE from scratch
- ALWAYS use the Turborepo generator: `bun turbo gen`
- Generator creates the full structure including Helm chart, Dockerfile

### Generated Code Rules
- NEVER edit any file inside `packages/api/src/generated/` or `*/generated/prisma/`
- ALWAYS run generation after changing `.proto`, `.graphql`, or `schema.prisma`
- See `.claude/skills/code-generation-pipeline/SKILL.md` for full conventions

### Architecture Axioms
- External API: GraphQL Federation via Apollo Router only
- Internal comms: gRPC only — never call another service's GraphQL endpoint internally
- Async events: Kafka + Debezium CDC
- Auth: Authentik OIDC (AuthentikAuthInterceptor on all gRPC services)
- Secrets: split by kind. DB/Redis credentials are static, Terraform-managed (`set_sensitive`, never a plain value in a committed chart file) — HashiCorp Vault and Infisical were both evaluated as a dynamic-credential provisioner for these and dropped (Vault's dynamic-credential lifecycle proved unreliable in practice; Infisical's self-hosted tier gates the same dynamic-secrets feature, and OIDC login to its UI, behind a paid Enterprise license). App-level secrets (API keys, JWT signing keys, third-party creds) go through `services/openbao` (a Linux Foundation, MPL-2.0 fork of Vault — dynamic secrets free in core, unlike Infisical) via `OpenBaoPlugin`'s KV v2 + Kubernetes auth, wired by the optional `turbo gen secrets` extension — deliberately scoped to app secrets only, never DB/Redis. Never commit .env files.
- Observability: OTEL → Alloy → Loki/Tempo/Prometheus → Grafana (always instrument new services)

### Reference Implementations
The concrete reference implementations (`server1-grpc`, `server2-grpc`, `server1-graphql`,
`server2-graphql`, `web1`, `mfe1`) have been removed from this repo. No live example remains
on disk. The structural patterns they established are still documented in `.claude/skills/`
(`backend-server-anatomy`, `graphql-subgraph-anatomy`, `frontend-webapp-anatomy`,
`code-generation-pipeline`) — treat those as the authoritative pattern description until a new
concrete reference is scaffolded and those docs are updated to point at it.

---

## Agent Portability Note

This CLAUDE.md and the skills in `.claude/skills/` are written to be agent-agnostic.
The conventions documented here describe what to do and why — not how to prompt a
specific AI model. These SOPs can be followed by Claude Code, local LLM agents
(Qwen, Llama, etc.), or human developers without modification.

When migrating to a different coding agent, copy `.claude/skills/` and this CLAUDE.md
to the equivalent location for that agent's convention system.
