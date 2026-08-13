## Context

Green-field feature — no existing servers or web apps in this repo to build on. Full planning session (Stages 1-5) produced: PRD (`prd.md`), system architecture + ERD + per-story flow/sequence diagrams (`diagrams/`), 3 ADRs (`adr-1.md` service split, `adr-2.md` CDC-driven notifications, `adr-3.md` unresolved email provider), dependency graph (`dependency-graph.md`), and UX specs (`interaction-specification.md`, `component-requirements.md`, `design-prompt.md`). This document consolidates the technical decisions from those artifacts into one place for implementers; see the source documents for full detail/rationale.

Constraint from Edward: this epic exists to validate the SDLC agent pipeline end-to-end — bias toward simplicity, but the repo's own architecture axioms (GraphQL Federation external / gRPC internal / Kafka+CDC async / Authentik auth / Vault secrets) are not up for renegotiation.

## Goals / Non-Goals

**Goals:**
- HR Admin can register/edit employees with payroll rate + supervisor hierarchy.
- Employees can submit leave; approval routes to supervisor, or to HR Admin when the requester is themselves a supervisor.
- Leave balance tracked per type (annual/sick), excess auto-converts to unpaid.
- Payroll auto-generates monthly, PDF in MinIO, reflecting unpaid deductions.
- Every user sees in-app notifications for the three defined events.

**Non-Goals:**
- Payroll disbursement/bank integration, attendance/timesheet, performance reviews, configurable leave types, mobile app, email/push notifications (in-app only), roles beyond HR Admin/Supervisor/Employee.
- Full PDPA workflow (data subject access/erasure requests, retention automation) — only the baseline (encryption at rest, access restriction, audit logging) ships now; see Open Questions.

## Decisions

### Service split: 4 new servers (employee, leave, payroll, notification)
Full rationale: `adr-1.md`. One service per entity-owning bounded domain, matching this repo's `turbo gen server` / `turbo gen driver` / per-server `-infra` chart pattern rather than a monolith. `leave-grpc`/`payroll-grpc` call `employee-grpc` via gRPC for hierarchy/rate; `notification` has no synchronous callers or dependents.

### Notifications via Debezium CDC, not app-level Kafka publish
Full rationale: `adr-2.md`. `leave-infra` and `payroll-infra` get a Debezium Server instance (`turbo gen debezium`) capturing `leave_request` and `payroll_record` row changes to Kafka; `notification` consumes both topics via `KafkaDriver`. No dual-write risk, matches CLAUDE.md's stated "Kafka + Debezium CDC" axiom directly.

### Proto / GraphQL contract changes
New contracts only (nothing existing to modify):
- `contracts/proto/services/employee/employee.proto` — `RegisterEmployee`, `UpdateEmployee`, `GetEmployee`, `ListEmployees`, `GetSupervisorChain`, `GetEmployeeRate`.
- `contracts/proto/services/leave/leave.proto` — `SubmitLeaveRequest`, `ReviewLeaveRequest`, `GetLeaveBalance`, `GetUnpaidLeaveDays`, `ListLeaveRequests`.
- `contracts/proto/services/payroll/payroll.proto` — `GetPayrollRecords` (read path for `payroll-subgraph`); `RunMonthlyPayroll` invoked internally by `payroll-cron`, not exposed to other services.
- `contracts/graphql/{employee,leave,payroll,notification}/` — one subgraph SDL per service, Federation v2 `@key` on each entity's `id`. Every mutation returns a Result type (success + typed errors) per `graphql-schema-design` convention.
- Authored on `api/{KAN-N}` branches after `/kickoff`, by the Architect (draft) + Data Engineer (review/compatibility + `api-type-generation`) — not during planning, since branches don't exist yet.

### Helm / infra changes
4 new `apps/servers/<name>` charts + 4 new `apps/servers/<name>-infra` charts (Postgres via `turbo gen database`; `leave-infra`/`payroll-infra` additionally `turbo gen debezium`). All `-infra` charts land in the shared `server-infra` namespace, apps in `server-apps`, applied via `apps/terraform` after `services/terraform` (Vault dependency). New `apps/web/hr-portal` chart + Dockerfile via `turbo gen web`.

### Kafka topics (new)
- `leave.leave_request` (CDC topic from `leave-infra`'s Debezium Server) — consumed by `notification`.
- `payroll.payroll_record` (CDC topic from `payroll-infra`'s Debezium Server) — consumed by `notification`.
Topic naming/provisioning: Data Engineer, `kafka-topic-provisioning` + `kafka-event-schema-design`, during `api/{KAN-4}`/`api/{KAN-5}`.

### Story dependencies (see `dependency-graph.md` for full detail)
Build order KAN-2 → KAN-3 → KAN-4 → KAN-5 → KAN-6. `api/` branches must merge before `task/` branches on every feature (repo-wide rule); backend `task/` PRs must merge before frontend `task/` PRs integrate.

## Risks / Trade-offs

- **[Risk] HR Admin transiently sees the employee's plaintext generated password** (mocked credential delivery, ADR-3 — Edward's Stage 7 decision: show it in a one-time success dialog rather than build email infrastructure) → **Mitigation**: dialog is single-view, password never logged or persisted client-side beyond the dialog; accepted as a POC-appropriate simplification, revisit if this feature moves beyond POC.
- **[Risk] First-time use of Authentik's *admin* API** (existing `AuthentikPlugin` only consumes auth, doesn't provision users) → **Mitigation**: flagged as a technical risk, not a blocker; Backend Developer should timebox a spike before committing to the `employee-grpc` implementation approach.
- **[Risk] 4-service split is heavier than a monolith for this feature's actual size** → **Mitigation**: accepted trade-off (ADR-1) — matches the repo's established scaffolding pattern, and exercising that pattern is itself part of this epic's stated purpose.
- **[Risk] Payroll cron re-run could double-charge/double-generate** → **Mitigation**: `PayrollRecord` uniqueness on `(employee_id, year_month)`, job checks-before-write (see KAN-5 AC).
- **[Risk] CDC lag means notifications aren't instant** → **Mitigation**: accepted, no stated latency SLA.

## Migration Plan

Nothing to migrate — every entity, service, and topic is net-new. Deploy order: `apps/terraform` (4 new `-infra` charts) → `employee` app chart → `leave` app chart → `payroll` app chart → `notification` app chart → `hr-portal` web chart, matching the story build order above. No rollback complexity beyond standard `helm rollback` per chart (nothing else depends on these being present yet).

## Open Questions

Both resolved at Stage 7 (see `escalations.md`):
1. ~~Email delivery provider for the credential email (KAN-2)~~ — **Resolved**: Edward chose mocked delivery (one-time success dialog), no email provider needed. See `adr-3.md`.
2. ~~PDPA baseline scope~~ — **Resolved**: baseline (encryption at rest, access restriction, audit log) ships as planned; deeper DSR/retention workflows remain deferred.
