# Database Migration

## Purpose
Creates and manages Prisma database migrations safely.

## Role
Backend Developer

## Phase
Development

## Triggered By
Schema change needed (new table, new field, modified field).

## Inputs
- Current `schema.prisma`

## Rule
PRISMA ONLY — never raw SQL migrations. One database per `*-grpc` service.

## Process
1. Modify `schema.prisma` (in `apps/servers/{service}/src/schemas/prisma/`).
2. Run: `bunx prisma migrate dev --name {descriptive-name}`.
   - Naming: descriptive, no timestamps (Prisma handles ordering).
   - Good: `add-user-profile-fields`. Bad: `migration-20240101`, `update`.
3. Review generated SQL migration file before committing.
4. Test UP migration: verify schema changes apply correctly.
5. Test DOWN migration: verify schema reverts cleanly (`bunx prisma migrate reset`, then re-run to verify).
6. Run: `bun turbo gen:prisma` (regenerates Prisma client).
7. Verify application still starts after migration.

NEVER edit generated migration files after creation. NEVER use `prisma db push` in production environments (migrations only).

## Outputs
Committed Prisma migration and regenerated Prisma client.

## Quality Gates
- [ ] Descriptive migration name (not timestamped)
- [ ] Both up and down migration tested locally
- [ ] Prisma client regenerated after migration
- [ ] Application starts successfully after migration

## References
- `.claude/skills/backend-developer/database-setup/SKILL.md`
