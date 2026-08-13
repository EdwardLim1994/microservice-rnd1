# Integration Test Case Design — hr-leave-payroll-platform

Service-to-service call paths, from Architect's sequence diagrams (`diagrams/KAN-*-sequence.md`). Real services used (local dev/SIT); only true externals (email provider once chosen) are mocked.

## KAN-2 — employee-subgraph → employee-grpc → Authentik / DB / Mail
1. Register with valid input → employee row created, Authentik user created, email send invoked.
2. Register with duplicate personal email → rejected, no Authentik user created, no email sent (no partial side effects).
3. Authentik provisioning call fails → employee row rolled back, error surfaced, no email sent.
4. Edit payroll rate/supervisor → persisted, reflected on subsequent `GetEmployee`.

## KAN-4 — leave-grpc → employee-grpc (GetSupervisorChain) → DB
1. Employee (non-supervisor) submits leave → `GetSupervisorChain` called, request routed to their supervisor.
2. Supervisor submits own leave → `GetSupervisorChain` identifies supervisor role, request routed to HR Admin instead.
3. Approve request → balance deducted in same transaction as status update.
4. Approve request exceeding balance → excess recorded as unpaid, balance correctly reflects zero remaining (not negative).
5. Employee attempts to approve own request → 403, no DB change.
6. Supervisor attempts to approve non-report's request → 403, no DB change.
7. `employee-grpc` unreachable during submission → leave submission fails cleanly (no orphaned request with unresolved reviewer).

## KAN-5 — payroll-cron → employee-grpc (GetEmployeeRate) + leave-grpc (GetUnpaidLeaveDays) → MinIO → DB
1. Full month, no unpaid leave → net amount equals full monthly rate.
2. Month with unpaid leave days → net amount reflects deduction.
3. Re-run for already-generated employee/month → no duplicate record, no duplicate MinIO object.
4. `leave-grpc` unreachable during run → that employee's payroll generation fails/retries, does not silently pay full rate (unpaid data must not be skipped-as-zero on error).
5. MinIO upload fails → no `PayrollRecord` persisted for that employee (no record pointing at a missing PDF).

## KAN-6 — Debezium (leave-infra/payroll-infra) → Kafka → notification-consumer → DB
1. `leave_request` insert → `leave.requested`-equivalent CDC event consumed → notification created for the correct supervisor/HR Admin.
2. `leave_request` status update (approve/reject) → CDC event consumed → notification created for the requesting employee.
3. `payroll_record` insert → CDC event consumed → notification created for the correct employee.
4. Malformed/unexpected CDC payload → consumer does not crash, event is logged and skipped (not silently dropped without trace).
