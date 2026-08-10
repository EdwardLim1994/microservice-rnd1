# Runbook Writing

## Purpose
Documents operational procedures as runbooks when DevOps establishes a new procedure.

## Role
Technical Writer

## Phase
Development (when DevOps establishes new procedure)

## Triggered By
DevOps establishes a new operational procedure.

## Inputs
Sources: DevOps operational procedures, Vault operations, Kafka recovery.

## Process
Write runbook in the fixed format:
- Title: `{Operation Name}`
- Purpose: when to use this runbook (one sentence)
- Prerequisites: what must be true before starting
- Steps: numbered, exact commands with expected output
- Verification: how to confirm success
- Rollback: how to undo if something goes wrong
- Escalation: who to contact if runbook fails

## Outputs
Location: `apps/docs/src/content/internal/latest/runbooks/`

## Quality Gates
- [ ] All six sections present (Purpose through Escalation)
- [ ] Steps include exact commands and expected output
- [ ] Rollback procedure documented
- [ ] Escalation contact specified

## References
- `.claude/skills/devops-engineer/disaster-recovery/SKILL.md`
- `.claude/skills/devops-engineer/vault-provisioning/SKILL.md`
