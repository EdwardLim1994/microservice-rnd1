# Performance Testing

## Purpose
Measures endpoint latency under load against both SLA floors and previous sprint baselines.

## Role
QA Engineer

## Phase
Staging

## Triggered By
`/release-staging` deploys, `regression-testing` combined suite passing.

## Inputs
- Staging cluster URL
- DevOps Grafana resource dashboards
- Previous sprint performance baseline

## Process
1. Run load tests using k6, measuring p50/p95/p99 per endpoint type.
2. Compare against BOTH: previous sprint baseline (trend) AND SLA floor (absolute).
3. Read DevOps Grafana resource dashboards during tests.
4. Record resource consumption at each load level.
5. Estimate cloud cost per user volume: "$X/month at N concurrent users".
6. Breach SLA → bug card (release blocking).
7. Improvable but within SLA → backlog card.

### SLA Thresholds (HARD floors)
- GraphQL query: p99 ≤ 500ms
- GraphQL mutation: p99 ≤ 1000ms
- gRPC call: p99 ≤ 200ms
- Kafka consumer: p99 ≤ 100ms

## Outputs
Performance report with SLA comparison, cost estimate; bug/backlog cards as applicable.

## Quality Gates
- [ ] p50/p95/p99 measured per endpoint type
- [ ] Compared against SLA floor and previous sprint baseline
- [ ] Resource consumption recorded from Grafana
- [ ] Cost estimate produced
- [ ] SLA breaches create release-blocking bug cards

## References
- `.claude/skills/qa-engineer/stress-testing/SKILL.md`
- `.claude/skills/qa-engineer/staging-sign-off/SKILL.md`
- DevOps Grafana dashboards
