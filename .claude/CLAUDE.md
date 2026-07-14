# Claude Code — Entry Point

Read this file at the start of every session before taking any action.

## Repository Structure

```
[monorepo root]
├── .claude/                               ← Claude Code operational config
│   ├── CLAUDE.md                          ← this file (auto-read every session)
│   └── SOP/
│       ├── handoff.md                     ← shared handoff rules
│       ├── project-management.md          ← /pm role
│       ├── qa.md                          ← /qa role
│       ├── development.md                 ← /dev role
│       └── devops.md                      ← /devops role
│
├── .openspec/                             ← requirements store
│   └── requirements/
│       ├── release/
│       │   └── [version]/
│       │       ├── requirements.yaml      ← user stories, features, test plans
│       │       └── [domain]-subgraph.api.graphql  ← federation SDL (if graphqlChanges)
│       └── hotfix/
│           └── [version]/
│               ├── requirements.yaml
│               └── [domain]-subgraph.api.graphql
│
├── ./docs/                                ← Astro Starlight documentation site
│   ├── astro.config.ts
│   ├── package.json
│   └── src/
│       └── content/
│           └── docs/
│               ├── business-logic/        ← /pm writes once per release
│               ├── api/                   ← /dev writes after each endpoint
│               ├── architecture/          ← /dev writes after user story PR
│               ├── data-flows/            ← /dev writes after user story PR
│               └── sdlc/                  ← /pm writes once per project setup
│
├── ./e2e/                                 ← Bun project: Vitest API + Cypress browser tests
├── ./servers/                             ← backend services
│   └── [domain]-subgraph/                 ← gRPC + GraphQL subgraph per domain
└── [frontend projects]
```

## Subgraph Naming Convention
Format: `[domain]-subgraph`
Derive domain name from `./servers/[domain]-subgraph/` folder structure.
Never invent subgraph names — always derive from the monorepo.

## Shared Rules (All Roles)
- Never branch from `main` directly
- Never create release branches — developer creates these manually
- Merge is always triggered by the developer — never merge autonomously
- Always read `.openspec/requirements/[release|hotfix]/[version]/requirements.yaml` as the source of truth
- Stop and notify the developer via GitHub issue comment if a blocking condition is met
- Always read the relevant role SOP before acting

## Branch Strategy
```
main
└── release/[version]                         🧑 Developer
    └── us/[issue-number]-[short-title]       🤖 /pm
        └── feat/[issue-number]-[short-title] 🤖 /pm
```

## Branch Naming Convention
| Type | Format | Example |
|---|---|---|
| Release | `release/[version]` | `release/v1.0.0` |
| User Story | `us/[issue-number]-[short-title]` | `us/42-sso-login` |
| Feature | `feat/[issue-number]-[short-title]` | `feat/47-oauth-token-exchange` |
| Bugfix (release) | `bugfix/[us-issue-number]-[desc]` | `bugfix/42-auth-token-null-pointer` |
| Hotfix | `hotfix/[new-version]-[desc]` | `hotfix/1.0.1-payment-crash` |
| Bugfix (hotfix) | `bugfix/[hotfix-sub-issue-number]-[desc]` | `bugfix/88-null-token-checkout` |

## Commit Message Convention
Format: `type(scope): description`

| Type | When to use |
|---|---|
| `feat:` | New feature implementation |
| `test:` | Adding or updating tests |
| `fix:` | Bug fix |
| `refactor:` | Code change with no behaviour change |
| `chore:` | Config, tooling, or dependency changes |
| `docs:` | Documentation only |

---

## Session Start — Detect Mode

At the start of every session, before taking any action, check in this order:

### Mode A — Run state exists (.claude/run-state.json present and phase != done)
A `/run` session is already in progress. Do not ask what to do — report status:
```
Run in progress: [mode] [version]
Current phase: [phase]
Paused at: [pauseReason]
Type /run continue to resume, or /run status for full details.
```

### Mode B — OpenSpec files already in .openspec/ (bootstrap script was run)
If `.openspec/requirements/[release|hotfix]/[version]/requirements.yaml` exists
but no `run-state.json` exists — the bootstrap script has been run and files are
ready. Do not ask which role to use. Prompt the developer:
```
OpenSpec files found for [version]. Ready to begin.
Run /run release [version] for the full automated SDLC,
or /run release [version] --checkpoint for role-by-role review,
or /pm to run project management only.
```

### Mode C — No OpenSpec files and no run state (fresh session)
If no files are attached, do not take any action until a command is given.

**Orchestrator command (runs all roles in sequence):**

| Command | Description | Reads |
|---|---|---|
| `/run release [version]` | Full release cycle | `.claude/commands/run.md` |
| `/run release [version] --checkpoint` | Release with role review pauses | `.claude/commands/run.md` |
| `/run hotfix [version]` | Full hotfix cycle | `.claude/commands/run.md` |
| `/run hotfix [version] --checkpoint` | Hotfix with role review pauses | `.claude/commands/run.md` |
| `/run continue` | Resume after a pause | `.claude/commands/run.md` |
| `/run status` | Show current run position | `.claude/commands/run.md` |
| `/run reset` | Clear run state | `.claude/commands/run.md` |

**Individual role commands:**

| Command | Role | Reads |
|---|---|---|
| `/pm` | Project Management | `.claude/SOP/project-management.md` |
| `/qa` | QA | `.claude/SOP/qa.md` |
| `/dev` | Development | `.claude/SOP/development.md` |
| `/devops` | DevOps | `.claude/SOP/devops.md` |

If a `/run` command is given — read `.claude/commands/run.md` before acting.
If a role command is given — read the corresponding SOP before acting.
If neither is given, ask:
> "How would you like to proceed? Use /run [release|hotfix] [version] to run the full SDLC, or /pm, /qa, /dev, /devops for a specific role."

### Hotfix Session
If the developer mentions a production bug or hotfix with no files attached, confirm:
> "Starting a hotfix session. Please provide: the current production version (e.g. 1.0.0) and a short description of the production problem. Then attach the OpenSpec files from the Claude.ai chat, or type /run hotfix [version] if files are already in .openspec/."

Then read `.claude/commands/run.md` or `.claude/SOP/project-management.md` depending on the chosen command.

### Run State
`.claude/run-state.json` persists the current run position between sessions.
If this file exists and `phase != done`, a run is in progress.
Always check for this file at session start before asking the developer what to do.
