# ClickHouse Schema Design

## Purpose
Designs ClickHouse table definitions for analytics data storage.

## Role
Data Engineer

## Phase
Planning (Stage 3)

## Triggered By
Story requires analytics or data warehouse storage.

## Inputs
- Analytics/reporting requirements from the story

## Location
`contracts/clickhouse/tables/{table-name}.sql`

## Process

### Engine Selection
- `MergeTree`: general purpose (most common)
- `ReplacingMergeTree`: deduplicate by version
- `SummingMergeTree`: aggregate numeric columns
- `AggregatingMergeTree`: custom aggregation

### Partitioning
Usually by date (`PARTITION BY toYYYYMM(date_column)`).

### Ordering Key
Most common query filters (`ORDER BY (field1, field2)`). `PRIMARY KEY` is a subset of `ORDER BY` (for index).

### DDL Mutation Awareness
Some ClickHouse DDL triggers background mutations that take hours:
- `ALTER TABLE ... DROP COLUMN` → mutation (hours for large tables)
- `ALTER TABLE ... MODIFY COLUMN` → mutation
- Adding a column is instant (safe)

Plan schema to avoid needing frequent mutations.

## Outputs
ClickHouse table DDL in `contracts/clickhouse/tables/{table-name}.sql`.

## Quality Gates
- [ ] Engine chosen with justification (comment in SQL)
- [ ] Partitioning strategy defined
- [ ] ORDER BY and PRIMARY KEY aligned with query patterns
- [ ] DDL mutation risks documented in comments

## References
- `.claude/skills/data-engineer/clickhouse-migration-writing/SKILL.md`
