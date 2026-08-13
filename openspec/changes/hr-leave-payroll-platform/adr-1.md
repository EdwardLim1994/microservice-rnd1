# ADR-1: Service Split — employee / leave / payroll / notification
# Date: 2026-08-10
# Status: Accepted

## Context
Epic KAN-1 touches employee data, leave workflow, payroll calculation, and cross-cutting notifications. Repo has zero scaffolded servers, so this is a from-scratch service boundary decision. `service-boundary-definition` rule: two services must never own the same entity; `*-subgraph` never accesses a DB directly.

## Options Considered
### Option A: Single monolithic server
One `apps/servers/hr` owning Employee, LeaveRequest, LeaveBalance, PayrollRecord, Notification in one DB.
- Simple to build, matches "keep it simple" steer from Edward.
- Violates nothing on day one, but couples unrelated lifecycles (payroll cron changes redeploy leave code) and contradicts the repo's per-domain server pattern (`turbo gen server` produces one service per domain, not one server for everything).

### Option B: Two services (employee+leave combined, payroll separate)
Leave is tightly coupled to employee (supervisor hierarchy) — combine to avoid a gRPC hop.
- Fewer inter-service calls for KAN-4.
- Still mixes two distinct entity lifecycles (employee master data vs. leave transactions) in one owner, and CLAUDE.md's generator/scaffolding pattern is one server per bounded domain, not per convenience.

### Option C: Four services — employee, leave, payroll, notification (chosen)
Each owns exactly one entity group; `leave`/`payroll` call `employee` via gRPC for hierarchy/rate; `notification` is a pure CDC-driven read projection with no synchronous callers.
- Matches repo's established one-server-per-domain scaffolding pattern (`turbo gen server`, `turbo gen driver`, per-server `-infra` chart).
- Clean entity ownership, no violations of the boundary rule.
- Costs 4x the scaffolding/deploy overhead of Option A for a proof-of-concept — acknowledged trade-off.

## Decision
Option C. The repo's whole generator/infra pattern (`apps/servers/<name>`, `apps/servers/<name>-infra`, `apps/terraform`) is built around one service per bounded domain — fighting that pattern to save scaffolding time would cost more later (and this epic's stated purpose is to validate the SDLC/generator pipeline itself, so exercising it as designed is the point, not a detour).

## Consequences
- 4 new `apps/servers/*` + 4 new `apps/servers/*-infra` charts, all Terraform-applied via `apps/terraform`.
- `leave-grpc` and `payroll-grpc` take a hard dependency on `employee-grpc` being available (gRPC calls) — sequencing matters at dev time (see `dependency-graph.md`).
- `notification` has zero synchronous dependents and zero synchronous dependencies — safest service to build/deploy last or in parallel.
- More moving parts than Option A for what is, functionally, a small feature set — accepted given the stated goal of exercising the full per-domain scaffolding pipeline.

## Related Decisions
[[ADR-2]] (CDC-driven notifications, depends on this split existing)
