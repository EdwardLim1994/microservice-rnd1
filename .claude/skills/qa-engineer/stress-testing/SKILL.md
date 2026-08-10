# Stress Testing

## Purpose
Finds the system's breaking point under escalating load and identifies which resource fails first.

## Role
QA Engineer

## Phase
Staging

## Triggered By
`performance-testing` complete.

## Inputs
- Staging cluster URL
- DevOps Grafana resource dashboards

## Process
1. Run k6 with escalating virtual users.
2. Identify breaking point and which resource hits ceiling first (CPU/Memory/DB/Kafka).
3. Record resource consumption at each load level from DevOps Grafana dashboards.
4. Produce cost projection at breaking point.
5. Produce improvement suggestions: which resource to optimise for best cost/performance.
6. Unacceptable breaking point → bug card (release blocking + escalate to Edward).

## Outputs
Breaking point report, cost projection, optimisation suggestions.

## Quality Gates
- [ ] Breaking point identified
- [ ] Limiting resource identified
- [ ] Cost projection at breaking point produced
- [ ] Unacceptable results escalated to Edward

## References
- `.claude/skills/qa-engineer/performance-testing/SKILL.md`
- `.claude/skills/shared/escalation-to-owner/SKILL.md`
