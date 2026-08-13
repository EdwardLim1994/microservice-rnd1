# Dependency Graph — hr-leave-payroll-platform (v0.1.0)

## Story Dependencies
- KAN-3 (Authentik Login) depends on: KAN-2 (Employee Registration) — Authentik account + employee record must exist before anyone can log in.
- KAN-4 (Leave Request/Approval) depends on: KAN-2 (employee + supervisor link), KAN-3 (session required to submit/review).
- KAN-5 (Payroll Generation) depends on: KAN-2 (payroll rate), KAN-4 (unpaid leave days for deduction calc).
- KAN-6 (Notifications) depends on: KAN-3 (session), KAN-4 (leave events), KAN-5 (payroll events).

Build order: KAN-2 → KAN-3 → KAN-4 → KAN-5 → KAN-6. KAN-2 is the critical-path root; nothing else can start meaningfully before it merges.

## Service Dependencies
- `leave-grpc` must have `employee-grpc`'s `GetSupervisorChain` RPC ready before its review-routing logic can be integrated/tested.
- `payroll-grpc` must have `employee-grpc`'s `GetEmployeeRate` and `leave-grpc`'s `GetUnpaidLeaveDays` RPCs ready before its monthly calc can be integrated/tested.
- `notification` must have `leave-infra` and `payroll-infra` Debezium Server instances emitting to Kafka before its consumer can be integrated/tested — but has no synchronous dependency, so its own scaffolding/skeleton can proceed in parallel with KAN-4/KAN-5.
- All four `*-infra` charts depend on `apps/terraform` being applied after `services/terraform` (Vault must exist first for dynamic-credential provisioning), per CLAUDE.md.

## Task Sequencing Within Features
- Each feature: `api/{KAN-N}` (proto + GraphQL SDL, Architect draft / Data Engineer review) → MUST merge first → unblocks `task/{KAN-N}` branches (CLAUDE.md hard rule).
- Each feature: Backend Developer's `task/` PR merged → unblocks Frontend Developer's `task/` PR (backend-first sequencing, CLAUDE.md).
- KAN-2's employee-grpc `RegisterEmployee` RPC (incl. Authentik provisioning + email send) must be functionally complete before KAN-2's frontend registration form can integrate end-to-end.

## External Dependencies
- Email delivery provider: **resolved — not needed.** Edward chose mocked credential delivery (one-time success dialog in `hr-portal`, ADR-3) instead of real email integration for v0.1.0.
- Authentik Admin API credential (for `employee-grpc` to provision accounts): Vault-provisioned, standard pattern — no new external account needed, but first time this repo calls Authentik's *admin* API (existing `AuthentikPlugin` is auth-consumption only, not provisioning) — flagged as a technical risk, not a blocker.
- PDF generation library for `payroll-grpc`: not yet chosen, low risk, decided at implementation time (any stdlib-adjacent PDF lib satisfies "simple format").
