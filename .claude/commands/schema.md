# /schema KAN-{N}

## Purpose
Data Engineer schema pipeline for a feature.

## Triggered By
Feature branch requires new or changed schema.

## Pre-checks
- `feat/{KAN-N}` branch exists.

## Steps
1. Data Engineer: `schema-implementation` (writes to `contracts/`).
2. Data Engineer: `apicurio-registration`.
3. Data Engineer: `kafka-topic-provisioning` (if Kafka events needed).
4. Data Engineer: `schema-compatibility-validation`.
5. Data Engineer: `api-type-generation` (generates `packages/api/src/generated/`).
6. Data Engineer: `schema-release-coordination` (signals backend/frontend unblocked).

## Output
Types generated, kanban tasks unblocked, PM signalled.

## On Failure
If `schema-compatibility-validation` fails (breaking change without deprecation): block and require either the deprecation flow or explicit Architect sign-off.

## References
- `.claude/skills/data-engineer/schema-implementation/SKILL.md`
- `.claude/skills/data-engineer/api-type-generation/SKILL.md`
- `.claude/skills/data-engineer/schema-release-coordination/SKILL.md`
