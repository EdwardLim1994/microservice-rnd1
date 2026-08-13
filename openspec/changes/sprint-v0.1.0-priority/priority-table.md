# Priority Table — Sprint v0.1.0 (hr-leave-payroll-platform)

Scoring per `.claude/skills/shared/priority-scoring-model`. Max weighted score = 57.5. Must Ship ≥ 70% (40.25), Should Ship 40-69% (23-40), Can Hold < 40% (<23).

| Rank | Story | Security (×3.0) | Dependency (×2.5) | Business (×2.0) | Impact (×1.5) | Testability (×1.5) | Complexity (×1.0) | Score | % | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | KAN-3 Auth Login | 5 | 3 | 5 | 5 | 2 | 4 | 47.0 | 81.7% | Must Ship |
| 2 | KAN-2 Employee Registration | 5 | 4 | 5 | 2 | 3 | 3 | 45.5 | 79.1% | Must Ship |
| 3 | KAN-4 Leave Request/Approval | 4 | 3 | 5 | 4 | 4 | 3 | 44.5 | 77.4% | Must Ship |
| 4 | KAN-5 Payroll Generation | 5 | 2 | 5 | 4 | 4 | 2 | 44.0 | 76.5% | Must Ship |
| 5 | KAN-6 Notifications | 2 | 1 | 3 | 5 | 2 | 3 | 28.0 | 48.7% | Should Ship |

## Justifications
- **KAN-2** Security=5 (PII + credential issuance, per threat-modelling). Dependency=4 (KAN-3/4/5 depend on it directly). Complexity=3 (new Authentik-provisioning + email-provider integration, first use of these patterns).
- **KAN-3** Security=5 (auth flow, categorical). Impact=5 (every user, every session). Complexity=4 (mostly reuses existing `AuthentikPlugin` pattern).
- **KAN-4** Security=4 (authorization/IDOR risk on approval routing, internal user data). Testability=4 (balance boundary + hierarchy-routing edge cases).
- **KAN-5** Security=5 (financial/payment-category data). Complexity=2 (most complex: cron + 2 cross-service gRPC calls + PDF + idempotency).
- **KAN-6** lowest score — no compliance override applies, not on the critical path (nothing depends on it), but Impact=5 since it's visible on every screen. **Should Ship**, not Must Ship — recommend keeping in v0.1.0 scope anyway since Edward explicitly requested it and sprint has no capacity constraint (POC, single feature epic); first candidate to descope if timeline slips.

## Compliance Override
KAN-2, KAN-4, KAN-5 additionally carry PDPA-baseline compliance requirements (encryption at rest, access restriction, audit log) — Must Ship regardless of score, per PRD §7-8.
