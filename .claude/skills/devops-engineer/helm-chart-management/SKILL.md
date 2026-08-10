# Helm Chart Management

## Purpose
Maintains and improves Helm charts for all services beyond their generator-created baseline.

## Role
DevOps Engineer

## Phase
Cross-phase (infrastructure)

## Triggered By
New service scaffolded; chart change needed.

## Inputs
- Generator-created chart (from `turbo gen`)

## Process
Maintains Helm charts in `charts/` for all services.

Values files per environment:
- `environments/sit/values/`
- `environments/uat/values/`
- `environments/staging/values/`
- `environments/production/values/`

Chart versioning: bump chart version with each change. Generator creates initial charts — DevOps maintains and improves. After generator runs: DevOps reviews generated chart for completeness.

## Outputs
Maintained, versioned Helm charts and per-environment values.

## Quality Gates
- [ ] Chart version bumped on every change
- [ ] Values consistent across all four environments
- [ ] Generated chart reviewed for completeness after scaffolding

## References
- `.claude/skills/devops-engineer/environment-config-management/SKILL.md`
- `.claude/skills/backend-developer/server-scaffolding/SKILL.md`
