# Claude Code — Entry Point

Read this file at the start of every session before taking any action.

## Shared Context (All Roles)

### Repository Structure
```
.claude/
├── CLAUDE.md                        ← this file
├── SOP/
│   ├── handoff.md                   ← shared handoff rules between roles
│   ├── project-management.md        ← issue creation, branch setup
│   ├── qa.md                        ← test creation, code review, quality gates
│   ├── development.md               ← implementation, PR creation
│   └── devops.md                    ← Terraform, Helm, environment config
└── requirements/
    └── [release-name].md            ← requirements document for current release
```

### Branch Strategy
```
main
└── release/[release-name]                    🧑 Created by developer
    └── us/[issue-number]-[short-title]       🤖 Project Management
        └── feat/[issue-number]-[short-title] 🤖 Project Management
```

### Branch Naming Convention
| Type | Format | Example |
|---|---|---|
| Release | `release/[release-name]` | `release/v1.2.0` |
| User Story | `us/[issue-number]-[short-title]` | `us/42-sso-login` |
| Feature | `feat/[issue-number]-[short-title]` | `feat/47-oauth-token-exchange` |

### Commit Message Convention
Format: `type(scope): description`

| Type | When to use |
|---|---|
| `feat:` | New feature implementation |
| `test:` | Adding or updating tests |
| `fix:` | Bug fix |
| `refactor:` | Code change with no behaviour change |
| `chore:` | Config, tooling, or dependency changes |
| `docs:` | Documentation only |

### Shared Rules
- Never branch from `main` directly
- Never create release branches — developer creates these manually
- Merge is always triggered by the developer — never merge autonomously
- Stop and notify the developer via GitHub issue comment if a blocking condition is met
- Always read the relevant role SOP before acting

---

## Role Selection

Do not take any action until a role is declared for this session.

Available roles and their slash commands:

| Command | Role | Reads |
|---|---|---|
| `/pm` | Project Management | `.claude/SOP/project-management.md` |
| `/qa` | QA | `.claude/SOP/qa.md` |
| `/dev` | Development | `.claude/SOP/development.md` |
| `/devops` | DevOps | `.claude/SOP/devops.md` |

If no slash command is given at session start, ask:
> "Which role should I operate as for this session? Available roles: /pm, /qa, /dev, /devops"

Once a role is declared, read the corresponding SOP immediately before proceeding.