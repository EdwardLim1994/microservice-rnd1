# Disaster Recovery

## Purpose
Documents and maintains recovery procedures for infrastructure failures.

## Role
DevOps Engineer

## Phase
Cross-phase (infrastructure)

## Triggered By
Infrastructure failure; scheduled DR review.

## Inputs
- Current infra topology and backup configuration

## Process

### PostgreSQL Backup
Per-service PostgreSQL: automated backups via `pg_dump` CronJob. Backup location: MinIO (internal object storage). Recovery: restore from backup + replay Debezium events from Kafka.

### Harbor Unavailability
ArgoCD cannot pull images → rollback to previous pod version. Recovery: restore Harbor or temporarily use alternative registry.

### ArgoCD State
Application definitions in Git (repo IS the backup). Recovery: reinstall ArgoCD + point at repo + sync.

### Kafka Consumer Offset Recovery
Consumer group lag monitoring alerts early. Recovery: reset consumer group offset to last good position.

### Vault Seal
Auto-unseal configured (cloud KMS or Shamir key shares). Recovery: unseal procedure documented in secure location.

### RTO Targets
SIT < 4 hours, Staging < 2 hours, Production < 30 minutes.

## Outputs
Documented recovery procedures per failure mode; RTO targets tracked.

## Quality Gates
- [ ] Recovery procedure documented for each failure mode above
- [ ] RTO targets defined per environment
- [ ] Unseal procedure stored in a secure location
- [ ] Backup restore procedure tested periodically

## References
- `.claude/skills/devops-engineer/vault-provisioning/SKILL.md`
- `.claude/skills/devops-engineer/harbor-registry-management/SKILL.md`
- `.claude/skills/devops-engineer/argocd-application-management/SKILL.md`
