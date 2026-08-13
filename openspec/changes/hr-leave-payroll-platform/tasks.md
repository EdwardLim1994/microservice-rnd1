## 1. KAN-2 — Employee Registration & Profile Management

- [ ] 1.1 [api] Design + author `contracts/proto/services/employee/employee.proto` (RegisterEmployee, UpdateEmployee, GetEmployee, ListEmployees, GetSupervisorChain, GetEmployeeRate) on `api/KAN-2`; Data Engineer reviews for compatibility.
- [ ] 1.2 [api] Design + author `contracts/graphql/employee/` SDL (Federation v2, `@key` on `id`) on `api/KAN-2`; Data Engineer reviews.
- [ ] 1.3 [devops] Scaffold `apps/servers/employee` via `turbo gen server`; `apps/servers/employee-infra` via `turbo gen database`.
- [ ] 1.4 [backend] Implement `employee-grpc` RPCs against generated proto types.
- [ ] 1.5 [backend] Spike + integrate Authentik Admin API user-provisioning call (first use of this pattern — see design.md risk).
- [ ] 1.6 [backend] `RegisterEmployee` returns the generated password once in its success payload (mocked credential delivery, ADR-3 — Edward-approved) — no email integration needed.
- [ ] 1.7 [backend] Implement `employee-subgraph` resolvers forwarding to `employee-grpc`.
- [ ] 1.8 [frontend] Scaffold `apps/web/hr-portal` via `turbo gen web` (first web app in this repo).
- [ ] 1.9 [frontend] Build Employee List, Registration form (incl. one-time success dialog showing email + password), Edit form per `interaction-specification.md` / `component-requirements.md`.
- [ ] 1.10 [qa] Unit tests: validation, duplicate-email check.
- [ ] 1.11 [qa] Component integration test: DB write + Authentik provisioning call.
- [ ] 1.12 [qa] e2e test: register → success dialog shows credentials → login round-trip (spans into KAN-3).
- [ ] 1.13 [security] Verify HR-Admin-only RBAC, server-side input validation, audit logging, PDPA baseline (encryption at rest, error-response scrubbing) per `specs/employee-management/spec.md`; apply sign-off label.

## 2. KAN-3 — Authentik Login for Employees

- [ ] 2.1 [backend] Wire `AuthentikPlugin`/OIDC login flow for `hr-portal`, read role claim.
- [ ] 2.2 [frontend] Build Login screen wrapper + role-based post-login routing.
- [ ] 2.3 [qa] Component integration test: login flow against Authentik.
- [ ] 2.4 [qa] e2e test: login → role-appropriate view.
- [ ] 2.5 [security] Verify Authentik lockout/rate-limit policy enabled, generic error messages (no user enumeration); apply sign-off label.

## 3. KAN-4 — Leave Request, Approval & Balance Tracking

- [ ] 3.1 [api] Design + author `contracts/proto/services/leave/leave.proto` + `contracts/graphql/leave/` SDL on `api/KAN-4`; Data Engineer reviews.
- [ ] 3.2 [devops] Scaffold `apps/servers/leave` + `apps/servers/leave-infra` (`turbo gen database` + `turbo gen debezium`).
- [ ] 3.3 [backend] Implement `leave-grpc` (submit/review/balance/unpaid-days/list), incl. hierarchy-aware routing via `GetSupervisorChain` call to `employee-grpc`.
- [ ] 3.4 [backend] Implement `leave-subgraph` resolvers.
- [ ] 3.5 [frontend] Build My Leave screen (balance + history), Leave Request form, Leave Approval Queue screen.
- [ ] 3.6 [qa] Unit tests: balance calc, unpaid-conversion boundary.
- [ ] 3.7 [qa] Integration tests: approval routing incl. supervisor→HR Admin branch, self-approval block, out-of-hierarchy block.
- [ ] 3.8 [qa] e2e test: submit → approve → balance updated.
- [ ] 3.9 [security] Verify self-approval/out-of-hierarchy blocks are server-side, PDPA baseline carried over from KAN-2's data store; apply sign-off label.

## 4. KAN-5 — Monthly Automated Payroll Generation

- [ ] 4.1 [api] Design + author `contracts/proto/services/payroll/payroll.proto` (`GetPayrollRecords`) + `contracts/graphql/payroll/` SDL on `api/KAN-5`; Data Engineer reviews.
- [ ] 4.2 [devops] Scaffold `apps/servers/payroll` + `apps/servers/payroll-infra` (`turbo gen database` + `turbo gen debezium`).
- [ ] 4.3 [backend] Implement `payroll-cron` `RunMonthlyPayroll`: fetch rate (`employee-grpc`) + unpaid days (`leave-grpc`), calculate net amount, idempotency check on `(employee_id, year_month)`.
- [ ] 4.4 [backend] Implement PDF rendering + MinIO upload via `MinioPlugin`.
- [ ] 4.5 [backend] Implement `payroll-grpc` `GetPayrollRecords` + `payroll-subgraph` resolvers, incl. owner/HR-Admin-only access check on PDF retrieval.
- [ ] 4.6 [frontend] Build My Payslips screen.
- [ ] 4.7 [qa] Unit tests: payroll calc incl. deduction, idempotency.
- [ ] 4.8 [qa] Integration test: cron trigger → PDF → MinIO.
- [ ] 4.9 [qa] e2e test: month-end run → employee sees notification (spans into KAN-6).
- [ ] 4.10 [security] Verify PDF access restriction, least-privilege Vault-issued cron credentials, MinIO SSE enabled, PDPA baseline; apply sign-off label.

## 5. KAN-6 — In-App Notifications

- [ ] 5.1 [api] Design + author `contracts/graphql/notification/` SDL (query `myNotifications`, mutations `markRead`/`markAllRead`) on `api/KAN-6`; Data Engineer reviews.
- [ ] 5.2 [devops] Scaffold `apps/servers/notification` + `apps/servers/notification-infra` (`turbo gen database`); Data Engineer provisions Kafka topic consumption for `leave.leave_request` + `payroll.payroll_record`.
- [ ] 5.3 [backend] Implement `KafkaDriver` consumer mapping CDC events → notification rows.
- [ ] 5.4 [backend] Implement `notification-subgraph` resolvers (list, unread count, mark read).
- [ ] 5.5 [frontend] Build notification icon + dropdown in `hr-portal`'s shared header layout.
- [ ] 5.6 [qa] Unit test: notification fan-out on event.
- [ ] 5.7 [qa] Integration test: event → notification record.
- [ ] 5.8 [qa] Frontend interaction test (Vitest + RTL + MSW): badge count, read/unread state, click-through navigation.
- [ ] 5.9 [security] Verify own-notifications-only reads (IDOR check); apply sign-off label.

## 6. Release Readiness

- [ ] 6.1 [devops] Apply `apps/terraform` for all 4 new `-infra` charts (after `services/terraform`).
- [ ] 6.2 [devops] Run local ZAP baseline scan (`cd test/zap && docker compose run zap-baseline`) before any story's PR is raised.
- [ ] 6.3 [qa] Regression pass confirming KAN-2 employee/supervisor edits don't orphan in-flight KAN-4 leave requests.
- [ ] 6.4 [pm] Confirm ADR-3 (email provider) resolved with Edward before KAN-2 is marked done — currently blocked.
