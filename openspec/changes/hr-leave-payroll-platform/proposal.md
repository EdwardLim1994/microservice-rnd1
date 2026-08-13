## Why

There is currently no way to record who works at the company, what they're paid, or who they report to, and no way for staff to request leave or get paid without a manual, off-system process. This change builds that as the first concrete feature run through the repo's SDLC agent pipeline — validating that the pipeline itself (planning → dev → UAT → staging → production) can carry a real, multi-service feature with minimal human supervision.

## What Changes

- New `employee` service: HR Admin registers/edits employee records (name, personal email, monthly payroll rate, supervisor — a self-referencing link to another employee); on registration, provisions an Authentik account and emails the employee a generated password.
- New `leave` service: employees submit leave requests (annual/sick/unpaid); requests route to the employee's supervisor for review, except a supervisor's own request routes to HR Admin instead; per-employee leave balance is tracked per type, and days beyond entitlement auto-convert to unpaid.
- New `payroll` service: a monthly cron job calculates each employee's pay (monthly rate minus unpaid-leave deduction), renders a PDF, and stores it in MinIO — idempotently, so a re-run does not double-generate.
- New `notification` service: a CDC-driven (Debezium → Kafka) read-model that surfaces an in-app notification icon on every screen for three events — leave requested (to the supervisor), leave decision (to the employee), payroll generated (to the employee).
- New `apps/web/hr-portal`: the single web app hosting all of the above (no existing web app to extend).

No existing capability is modified or removed — this repo currently has no scaffolded servers or web apps.

## Capabilities

### New Capabilities
- `employee-management`: employee CRUD, payroll-rate and supervisor-hierarchy tracking, Authentik account provisioning + credential email on registration.
- `leave-management`: leave request submission, hierarchy-aware approval routing (supervisor → HR Admin exception), fixed-type balance tracking with unpaid auto-conversion.
- `payroll-generation`: monthly automated payroll calculation, PDF generation, MinIO storage, idempotent per employee per month.
- `in-app-notifications`: CDC-driven notification feed for leave and payroll events, unread badge, mark-read.

### Modified Capabilities
None — no existing specs in `openspec/specs/` to modify (this is the first change in the repo).

## Impact

- **New servers**: `apps/servers/employee`, `apps/servers/leave`, `apps/servers/payroll`, `apps/servers/notification`, each with its own `apps/servers/<name>-infra` chart (Postgres; `leave`/`payroll` additionally get a Debezium Server instance).
- **New web app**: `apps/web/hr-portal`.
- **New contracts**: `contracts/proto/services/{employee,leave,payroll}/`, `contracts/graphql/{employee,leave,payroll,notification}/`.
- **Terraform**: `apps/terraform` gains 4 new `-infra` `helm_release`s (applied after `services/terraform`, since Vault must exist first).
- **External dependency, unresolved**: an email-delivery mechanism for the credential email (see `adr-3.md`) — no such capability exists in this repo today; flagged for Edward's decision, does not block proposal/design/tasks authoring but blocks final `employee` service completion.
- **No breaking changes** — nothing existing to break.
