# Secrets Scanning Pipeline Integration

## Purpose
Wires GitLeaks/TruffleHog secrets scanning into CI pipelines.

## Role
DevOps Engineer

## Phase
Development (CI infrastructure)

## Triggered By
Task merged to story branch; story merged to release branch.

## Inputs
- CI pipeline configuration

## Process
Wires GitLeaks and/or TruffleHog into CI pipelines. Runs on: task merged to story branch, story merged to release branch.

DevOps wires the tool execution. Security Engineer monitors results.

### Configuration
- `.gitleaks.toml`: define scan rules and allowlist for known false positives
- CI job: fail pipeline if any secret found
- Report: security scan results available as pipeline artifact

Security Engineer reads reports — DevOps does not interpret findings.

## Outputs
Secrets scan wired into CI, producing artifact reports on each run.

## Quality Gates
- [ ] Scan runs on both trigger points (task→story, story→release)
- [ ] Pipeline fails on any secret found
- [ ] Reports available as pipeline artifacts
- [ ] Allowlist maintained for known false positives only

## References
- `.claude/skills/security-engineer/secrets-scanning/SKILL.md`
- `.claude/skills/devops-engineer/task-pr-pipeline/SKILL.md`
