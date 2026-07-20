# Claude Code — Entry Point

Read this file at the start of every session before taking any action.

## Repository Structure

```
[monorepo root]
├── .claude/
│   ├── CLAUDE.md                          ← this file
│   ├── commands/
│   │   ├── pr.md                          ← /pr command
│   │   ├── qa.md                          ← /qa command
│   │   ├── fix.md                         ← /fix command
│   │   ├── dev.md                         ← /dev command
│   │   └── review.md                      ← /review command
│   └── SOP/
│       ├── handoff.md
│       ├── project-management.md          ← bugfix/hotfix issue creation reference
│       ├── qa.md                          ← integration test authoring
│       └── devops.md                      ← CI/CD and deployment
│
├── .openspec/
│   └── requirements/
│       ├── release/[version]/
│       │   ├── requirements.yaml
│       │   ├── deployment.yaml            ← service deployment manifest
│       │   └── [domain]-subgraph.api.graphql
│       └── hotfix/[version]/
│           ├── requirements.yaml
│           ├── deployment.yaml
│           └── [domain]-subgraph.api.graphql
│
├── .github/workflows/
│   ├── integration-tests.yml              ← feat/**, bugfix/**
│   ├── e2e-tests.yml                      ← PR targeting release/**
│   ├── sonarqube.yml                      ← feat/**, us/**, bugfix/**, hotfix/**
│   ├── deploy-uat.yml                     ← tag: v*-rc*
│   └── deploy-production.yml              ← tag: v[0-9]*.[0-9]*.[0-9]* (stable only)
│
├── ./docs/                                ← Astro Starlight
├── ./e2e/                                 ← Bun: Vitest API + Cypress
├── ./servers/
│   ├── [domain]/                          ← gRPC server (primary deployable)
│   └── [domain]-subgraph/                 ← GraphQL subgraph SDL (travels with gRPC server)
├── ./frontends/
│   └── [app]/                             ← microfrontend web apps
└── ./apps/
    ├── [web-app]/                         ← full webpages
    └── [mobile-app]/                      ← mobile apps (React Native Expo — placeholder)
```

## Subgraph Naming Convention

- Subgraph: `[domain]-subgraph` (e.g. `auth-subgraph`)
- gRPC server: `[domain]` (e.g. `auth`)
- Both live alongside each other in `./servers/`
- Deployment targets the gRPC server — subgraph SDL travels with it

## Branch Strategy

```
main
├── release/[version]                          ← /pr creates
│   └── us/[issue-number]-[short-title]        ← /pr creates
│       └── feat/[issue-number]-[short-title]  ← /pr creates
└── hotfix/[version]-[desc]                    ← /pr creates (same level as release)
    └── bugfix/[hotfix-sub-issue-number]-[desc] ← /pr creates
```

| Branch | Format | Created from | Merged into | Deleted after |
|---|---|---|---|---|
| `release/` | `release/[version]` | `main` | `main` | Never |
| `us/` | `us/[number]-[title]` | `release/` | `release/` | After merge |
| `feat/` | `feat/[number]-[title]` | `us/` | `us/` | After merge |
| `bugfix/` (us branch) | `bugfix/[us-number]-[desc]` | `us/` | `us/` | After us/ merges |
| `bugfix/` (release branch) | `bugfix/[release-ver]-[desc]` | `release/` | `release/` | After stable tag |
| `hotfix/` | `hotfix/[version]-[desc]` | `main` | `main` | Never |
| `bugfix/` (hotfix) | `bugfix/[hotfix-sub-number]-[desc]` | `hotfix/` | `hotfix/` | After hotfix merge |

**No local merges ever. Every branch transition goes through a PR. Developer merges all PRs.**

## Tag Strategy

| Tag | Format | Trigger | Deploys to |
|---|---|---|---|
| RC | `v[version]-rc[n]` | `/pr tag rc [version]` | UAT environment |
| Stable | `v[version]` | `/pr tag stable [version]` | Production environment |
| Hotfix RC | `v[version]-rc[n]` | `/pr tag hotfix-rc [version]` | UAT environment |
| Hotfix stable | `v[version]` | `/pr tag hotfix-stable [version]` | Production environment |

RC tags increment: `v1.0.0-rc1`, `v1.0.0-rc2` etc. if UAT fixes are needed.

## Selective Deployment

CI reads `deployment.yaml` from `.openspec/` to determine which services to build and deploy.

| Service type | Path | Deploy condition |
|---|---|---|
| `grpc` | `./servers/[domain]/` | `deploy: true` in deployment.yaml |
| `microfrontend` | `./frontends/[app]/` | `deploy: true` in deployment.yaml |
| `webapp` | `./apps/[app]/` | `deploy: true` in deployment.yaml |
| `mobile` | `./apps/[app]/` | Always `deploy: false` — Expo pipeline placeholder |
| `chore: true` | any | Skip all deployments |

## Shared Reference Documents

All commands read these SOP files for standards and patterns before acting:

| Document | Read by | Purpose |
|---|---|---|
| `.claude/SOP/testing-standards.md` | `/qa`, `/dev`, `/fix`, `/review` | Test patterns, rules, CI triggers, failure handling for all three test layers (unit/integration/e2e) |
| `.claude/SOP/handoff.md` | All commands | Handoff comment templates between roles |
| `.claude/SOP/devops.md` | `/devops`, `/review release` | CI/CD workflow definitions, tag-to-deploy, selective deployment |
| `.claude/SOP/project-management.md` | `/pr` | Bugfix/hotfix issue creation reference |

---

## Commit Convention

Format: `type(scope): description`

| Type | When |
|---|---|
| `feat:` | New feature |
| `test:` | Tests |
| `fix:` | Bug fix |
| `refactor:` | No behaviour change |
| `chore:` | Config, tooling, openspec, ci |
| `docs:` | Documentation |

## CI Quality Gates

Claude Code waits for CI before opening any PR. Max 3 fix cycles then `/blocked`.

| Workflow | Triggers on | Runs |
|---|---|---|
| `integration-tests.yml` | push `feat/**`, `bugfix/**` | Integration tests |
| `e2e-tests.yml` | PR targeting `release/**` | kind cluster + Vitest + Cypress |
| `sonarqube.yml` | push `feat/**`, `us/**`, `bugfix/**`, `hotfix/**` | SonarQube Cloud |
| `deploy-uat.yml` | tag `v*-rc*` | Selective service deploy to UAT |
| `deploy-production.yml` | tag `v[0-9]*.[0-9]*.[0-9]*` (stable) | Selective service deploy to production |

Claude Code never runs SonarQube locally. CI owns all scanning.

---

## Deprecated Commands

The following commands no longer exist and must never be suggested or used:

| Deprecated | Replaced by | Reason |
|---|---|---|
| `/e2e [us-number]` | `/qa [us-number]` | `/e2e` command file deleted — `/qa` owns all test case creation |

If any document, conversation history, or prior session suggests using `/e2e`,
ignore it and use `/qa` instead. `/e2e` is not a valid command in this project.

---

## Session Start

Check in this order at the start of every session:

### 1 — OpenSpec files present in .openspec/?

Prompt:

```
OpenSpec found for [version].
What would you like to do?
  /pr [version]                    — create release branch, issues, branches
  /pr tag rc [version]             — create RC tag → UAT deploy
  /pr tag stable [version]         — create stable tag → production deploy + release PR
  /pr uat-fix [version]            — read release PR comments, create UAT fix
  /qa [us-number]                  — create QA tests for a user story (merge QA PR before /dev)
  /dev [us-number]                 — implement all features for a user story
  /dev feat [number]               — implement one specific feature
  /dev us [us-number]              — open user story PR
  /dev bugfix [number]             — fix a bugfix branch
  /dev hotfix [version]            — implement all hotfix bugfixes
  /review [us-number]              — review all features for a user story
  /review feat [number]            — review one specific feature
  /review release [version]        — full release review before RC tag
```

### 2 — No OpenSpec and no command given

Ask:

```
No OpenSpec files found. Run the bootstrap script from the Claude Project alignment chat first:
  bash bootstrap-[version].sh

Then use /pr [version] to begin.

If starting mid-SDLC, which command would you like to run?
```

### Hotfix session

If developer mentions a production bug:

```
Starting a hotfix. Please provide:
  - Current production version (e.g. 1.0.0)
  - Short description of the production problem
  - New patch version (e.g. 1.0.1)

Run the bootstrap script then: /pr hotfix [new-version]
```

---

## Available Commands

| Command | Reads | Does |
|---|---|---|
| `/pr [version]` | `.claude/commands/pr.md` | Creates release branch, OpenSpec commit, labels, milestone, issues, branches, deployment.yaml validation, business logic docs |
| `/pr hotfix [version]` | `.claude/commands/pr.md` | Creates hotfix branch, issues, bugfix branches |
| `/pr tag rc [version]` | `.claude/commands/pr.md` | Creates RC tag → triggers UAT deployment |
| `/pr tag stable [version]` | `.claude/commands/pr.md` | Creates stable tag → triggers production deployment + opens release→main PR |
| `/pr tag hotfix-rc [version]` | `.claude/commands/pr.md` | Creates hotfix RC tag |
| `/pr tag hotfix-stable [version]` | `.claude/commands/pr.md` | Creates hotfix stable tag + opens hotfix→main PR |
| `/pr uat-fix [version]` | `.claude/commands/pr.md` | Reads release PR comments, creates UAT bugfix issue and branch |
| `/qa [us-number]` | `.claude/commands/qa.md` | Creates [QA] issue, writes Vitest integration tests + Cypress e2e tests (headless), opens QA PR into user story branch |
| `/dev [us-number]` | `.claude/commands/dev.md` | All features sequentially, integration tests, CI gate, feature PRs |
| `/dev feat [number]` | `.claude/commands/dev.md` | One specific feature |
| `/dev us [us-number]` | `.claude/commands/dev.md` | Opens user story PR |
| `/dev bugfix [number]` | `.claude/commands/dev.md` | Fixes bugfix branch, opens PR |
| `/dev hotfix [version]` | `.claude/commands/dev.md` | All bugfix branches under hotfix |
| `/review [us-number]` | `.claude/commands/review.md` | Reviews all features under a user story, fixes inline, pushes |
| `/review feat [number]` | `.claude/commands/review.md` | Reviews one specific feature |
| `/review release [version]` | `.claude/commands/review.md` | Full release branch review — completeness, contracts, federation, docs, deployment manifest, branch cleanliness, code quality, integration tests, e2e tests |
| `/devops` | `.claude/SOP/devops.md` | CI/CD pipeline setup or release deployment |

When any command is given — read the corresponding file before acting.

---

## Shared Rules

- Never merge locally — every branch transition goes through a PR
- Developer merges all PRs — Claude Code only opens them
- Developer creates all tags via `/pr tag` commands — Claude Code executes the git tag commands
- Always read `.openspec/` as the source of truth
- `deployment.yaml` determines which services CI builds and deploys
- Mobile (`type: mobile`) always has `deploy: false` — Expo pipeline is a placeholder
- Chore releases (`chore: true`) skip all service deployments
- Post `/blocked` on the relevant GitHub issue when a stopping condition is hit
- CI must pass before any PR is opened — max 3 fix cycles then `/blocked`
