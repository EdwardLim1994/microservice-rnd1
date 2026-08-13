# ADR-2: Notifications via Debezium CDC, not app-level event publish
# Date: 2026-08-10
# Status: Accepted

## Context
KAN-6 needs `notification` to learn about leave and payroll events without owning leave/payroll data (service boundary rule). Two ways to get it that data: the source service explicitly publishes a Kafka event in application code, or the existing CDC pipeline (Debezium Server → Kafka, already the documented pattern for `apps/servers/<name>-infra` via `turbo gen debezium`) picks up the row change automatically.

## Options Considered
### Option A: App-level Kafka producer in leave-grpc / payroll-grpc
Service code explicitly publishes `leave.requested`, `leave.reviewed`, `payroll.generated` to Kafka after each DB write.
- Explicit, easy to reason about locally.
- New pattern not currently scaffolded anywhere in `packages/server` (no producer helper exists, `KafkaDriver` in the framework is consumer-oriented); adds hand-rolled at-least-once/outbox concerns (DB write + Kafka publish must not drift) that CDC gets for free.

### Option B: Debezium Server CDC per service (chosen)
`leave-infra` and `payroll-infra` each get a Debezium Server instance (via `turbo gen debezium`, already an established per-server extension in this repo) capturing row changes on `leave_request` and `payroll_record` tables, publishing to Kafka topics `notification` consumes via `KafkaDriver`.
- Matches CLAUDE.md's stated axiom directly: "Async events: Kafka + Debezium CDC" — this is the documented pattern, not a new one.
- No dual-write risk (DB write is the only write; Kafka follows automatically).
- Notification content is derived from row state, not a hand-shaped event payload — `notification`'s consumer must map raw CDC row changes to notification text itself.

## Decision
Option B — `turbo gen debezium` on `leave-infra` and `payroll-infra`, `notification` consumes both topics via `KafkaDriver`.

## Consequences
- `leave` and `payroll` servers need zero notification-awareness in their own code — clean boundary, no coupling to `notification`'s existence.
- `notification`'s consumer does more interpretation work (map CDC payload → human-readable notification), but that logic lives in one place instead of scattered across two producers.
- CDC lag (Debezium capture interval) means notifications are near-real-time, not instant — acceptable for this feature (no stated latency SLA from Edward).

## Related Decisions
[[ADR-1]] (service split this depends on)
