# PRD — HR Employee Management, Leave & Payroll Platform

Change slug: `hr-leave-payroll-platform` · Epic: KAN-1 · Target: v0.1.0

## 1. Problem Statement
HR Admin (sole super-admin) needs to manage employee records — personal details, monthly payroll rate, supervisor assignment (supervisor is itself an employee) — and run a leave workflow where an employee's leave routes to their supervisor for approval, and a supervisor's own leave routes to HR Admin. Registration is manual by HR Admin; on success the system shows HR Admin a one-time success dialog with the employee's personal email and generated password (mocked credential delivery for v0.1.0 — no real email integration, see ADR-3), login via Authentik (email + password only). Leave types are fixed (annual, sick, unpaid), each employee has a fixed entitlement per type with balance tracking; leave beyond entitlement auto-converts to unpaid. Payroll auto-generates monthly via cron: monthly rate minus unpaid-leave deduction, rendered as a simple PDF stored in MinIO. Every logged-in user sees an in-app notification icon for: new leave request (supervisor), leave decision (employee), payroll generated (employee). This is a proof-of-concept run end-to-end through the SDLC agent pipeline to validate autonomous project management with minimal supervision — bias toward simplicity throughout.

## 2. User Stories
- [KAN-2](../../../.kanban/boards.json) — Employee Registration & Profile Management
- KAN-3 — Authentik Login for Employees
- KAN-4 — Leave Request, Approval & Balance Tracking
- KAN-5 — Monthly Automated Payroll Generation
- KAN-6 — In-App Notifications

(Full AC, security AC, accessibility AC per story: `.kanban/boards.json`.)

## 3. Technical Requirements per Service

### `employee` (new: employee-grpc + employee-subgraph)
- Must do: CRUD employee (name, personal email, payroll rate, supervisor FK), provision Authentik account on create, return the generated password in the registration mutation's success payload (once, for the UI to display — mocked delivery, ADR-3), expose `GetSupervisorChain`/`GetEmployeeRate` for internal callers.
- API contracts: `contracts/proto/services/employee/employee.proto` (new), `contracts/graphql/employee/` (new) — designed at Stage 3, authored on `api/{KAN-2}` branch post-kickoff.

### `leave` (new: leave-grpc + leave-subgraph + Debezium Server)
- Must do: submit/review leave requests, enforce authorization routing (self-block, hierarchy-scoped supervisor, HR Admin for supervisors), track/deduct balance, auto-convert excess to unpaid, expose `GetUnpaidLeaveDays` for payroll, emit row changes to Kafka via CDC.
- API contracts: `contracts/proto/services/leave/leave.proto` (new), `contracts/graphql/leave/` (new) — `api/{KAN-4}`.

### `payroll` (new: payroll-grpc + payroll-subgraph + CronDriver + Debezium Server)
- Must do: month-end cron calculates net pay per employee (rate − unpaid deduction), generates PDF, uploads to MinIO, persists record idempotently, emits row changes to Kafka via CDC.
- API contracts: `contracts/proto/services/payroll/payroll.proto` (new), `contracts/graphql/payroll/` (new) — `api/{KAN-5}`.

### `notification` (new: notification-subgraph + KafkaDriver consumer)
- Must do: consume `leave` and `payroll` CDC topics, persist notification rows, expose query (list own, unread count) + mark-read mutation.
- API contracts: `contracts/graphql/notification/` (new) — `api/{KAN-6}`. No proto needed (no other service calls it synchronously).

Full boundary definitions, ownership, and rationale: `diagrams/hr-leave-payroll-platform-erd.md`, `adr-1.md`.

## 4. Data Model Implications
New entities, one owner each (no cross-service DB access): `Employee`, `LeaveBalance`, `LeaveRequest`, `PayrollRecord`, `Notification`. Full schema: `diagrams/hr-leave-payroll-platform-erd.md`. Each `*-infra` chart (`apps/servers/<name>-infra`) provisions its own Postgres via `turbo gen database`; `leave-infra` and `payroll-infra` additionally get `turbo gen debezium` (ADR-2). No migration requirements — all net-new schemas, first migration is the initial one.

## 5. Platforms Involved
Web only (`apps/web/hr-portal`, new — no existing web app scaffolded). No mobile app in this epic.

## 6. Non-Functional Requirements
- Scalability: employee headcount and leave/payroll volume are small for a POC — no special scaling design needed beyond the framework defaults.
- The `payroll-cron` job must be idempotent per employee per month (re-run safety) — see KAN-5 AC.
- Notification delivery is near-real-time (CDC lag), not instant — no stated SLA from Edward, acceptable as-is.

## 7. Security Requirements
Compiled from Stage 2 threat-modelling / security-story-review (full detail on each story card in `.kanban/boards.json`):
- **Functional security:** server-side RBAC on every mutation (HR-Admin-only employee writes; self-approval and out-of-hierarchy approval blocked on leave; own-notifications-only reads); input validation server-side, never trusted from client; generic auth error messages (no user enumeration); Authentik native rate-limiting/lockout on login. Note: the registration mutation's success payload deliberately includes the generated password once (mocked credential delivery, ADR-3) — a narrow, intentional exception to "never return secrets in API responses," not a pattern to repeat elsewhere.
- **Non-functional security:** audit log on employee create/edit and leave approve/reject (repudiation control); least-privilege Vault-issued credentials for the payroll cron job; MinIO payroll PDFs access-checked per employee (never a public/guessable URL).
- **Compliance (Must Ship, bypasses scoring — PDPA Malaysia):** field/DB-level encryption at rest for Employee PII and PayrollRecord financial data; access restricted to HR Admin + record owner; MinIO server-side encryption enabled on the payroll bucket. Deeper PDPA workflows (data subject access/erasure requests, retention automation) explicitly deferred — flagged at Stage 7, Edward had scoped "no extra regulatory controls" but compliance override makes this baseline non-negotiable.

## 8. Compliance Requirements
See §7 — PDPA baseline (encryption at rest, access restriction, audit logging on PII writes) is Must Ship on KAN-2, KAN-4, KAN-5 regardless of priority score.

## 9. Performance SLAs
Standard repo-wide floors apply (CLAUDE.md) — no story in this epic has a stated exception:
- GraphQL query p99 ≤ 500ms
- GraphQL mutation p99 ≤ 1000ms
- gRPC call p99 ≤ 200ms
- Kafka consumer p99 ≤ 100ms (applies to `notification`'s CDC consumer)

## 10. Test Data Requirements
Per-story detail: `test-data/strategy-KAN-2.md`, `strategy-KAN-4.md`, `strategy-KAN-5.md`, `strategy-KAN-6.md` (KAN-3 reuses KAN-2's employee/Authentik fixtures, no separate strategy needed).

## Sign-off
Drafted by PM synthesising Stages 1-4 (PO, QA, Security, Architect, UI/UX all represented above). Reviewed inline during this planning session — no dissent recorded. Proceeding to Stage 6.
