# Sprint Plan — v0.1.0 (hr-leave-payroll-platform)

## Capacity Calculation
This is the first sprint through this SDLC pipeline, agent-executed rather than human-velocity-based, so real historical throughput doesn't exist yet. Working assumption (flagged as an estimate, adjustable by Edward):
```
Available parallel workstreams: 5 (backend, frontend, qa, security, devops — per role, across stories where dependency order allows)
Average task duration: 0.5 day (tasks.md items are sized for one PR each, per task-breakdown-review)
Sprint duration: 10 working days (2 calendar weeks)
Maximum tasks = 5 × 10 / 0.5 = 100 task-slots
```
39 kanban cards exist for this epic (5 features, 5 api, 10 task, 5 qa, 5 security, 4 devops, plus 1 release-level devops) — comfortably inside capacity even accounting for the hard sequencing rules below cutting real parallelism. This is the answer to Edward's Q6 ("target go-live — see how much time estimated first"): **~2 weeks, first-pass estimate**.

## Scope: All 5 Stories (Must Ship ×4 + Should Ship ×1)
Must Ship stories are always included regardless of capacity; Should Ship (KAN-6) fits within calculated capacity, so also included — no story deferred to Can Hold.

| Story | Priority | Included |
|---|---|---|
| KAN-2 Employee Registration | Must Ship (79.1%) | Yes |
| KAN-3 Authentik Login | Must Ship (81.7%) | Yes |
| KAN-4 Leave Request/Approval | Must Ship (77.4%) | Yes |
| KAN-5 Payroll Generation | Must Ship (76.5%) | Yes |
| KAN-6 In-App Notifications | Should Ship (48.7%) | Yes (no capacity constraint) |

## Dependency-Respecting Build Order
Per `dependency-graph.md`: **KAN-2 → KAN-3 → KAN-4 → KAN-5 → KAN-6**, with `api/` branches merging before `task/` branches on every feature, and backend `task/` branches merging before frontend `task/` branches (repo-wide rules). Concretely:
1. KAN-38 (employee-infra) → KAN-12 (employee api) → KAN-13 (employee backend) → KAN-14 (employee frontend) → KAN-15/16 (qa/security)
2. KAN-17 (auth login, depends on KAN-13) → KAN-18/19 (qa/security) — can start once KAN-13 merges, doesn't need KAN-14
3. KAN-25 (leave-infra) → KAN-20 (leave api) → KAN-21 (leave backend, needs KAN-13's GetSupervisorChain) → KAN-22 (leave frontend) → KAN-23/24 (qa/security)
4. KAN-31 (payroll-infra) → KAN-26 (payroll api) → KAN-27 (payroll backend, needs KAN-13's GetEmployeeRate + KAN-21's GetUnpaidLeaveDays) → KAN-28 (payroll frontend) → KAN-29/30 (qa/security)
5. KAN-37 (notification-infra, needs KAN-25/KAN-31's Debezium instances live) → KAN-32 (notification api) → KAN-33 (notification backend) → KAN-34 (notification frontend) → KAN-35/36 (qa/security)
6. KAN-39 (terraform apply for all 4 `-infra` charts) can run any time after each story's `-infra` scaffold task completes, and must complete before that story's `api/` branch integration testing needs a live cluster.

Data-Engineer `api/` first-merge rule verified: every feature (KAN-7/8/9/10/11) has its `api` card scheduled before its `task` cards above.

## Escalations
See `escalations.md` — all 3 items resolved by Edward at Stage 7 (mocked credential delivery instead of email; PDPA baseline confirmed; KAN-6 kept in scope). No blockers remain.

## Sprint Goal
Ship the full hr-leave-payroll-platform v0.1.0 epic (all 5 stories) as the first feature to complete this repo's SDLC pipeline end-to-end (Planning → Dev → UAT → Staging → Production), validating the pipeline itself.

**Status: awaiting Edward's `/kickoff v0.1.0` approval.**
