# Task PR Pipeline

## Purpose
Defines the CI checks run on every PR into task/, feat/, api/, qa/, security/, devops/ branches.

## Role
DevOps Engineer

## Phase
Development

## Triggered By
PR opened/updated against `task/`, `feat/`, `api/`, `qa/`, `security/`, `devops/`.

## Inputs
- PR diff

## Process
GitHub Actions workflow steps:
1. `bun turbo lint && bun turbo check` (TypeScript)
2. `bun turbo test` (unit tests)
3. SonarQube scan → results as PR comment
4. `buf breaking` (if PR touches `contracts/`)
5. `helm lint` (if PR touches `charts/`)
6. `terraform validate` (if PR touches `terraform/`)
7. GitLeaks/TruffleHog secrets scan

Gate: all checks pass → Tech Lead review enabled.

## Outputs
CI status on PR; Tech Lead review gate unlocked on pass.

## Quality Gates
- [ ] All applicable steps run based on changed paths
- [ ] SonarQube results posted as PR comment
- [ ] Tech Lead review only enabled after all checks pass

## References
- `.claude/skills/tech-lead/code-review/SKILL.md`
- `.claude/skills/devops-engineer/secrets-scanning-pipeline-integration/SKILL.md`
