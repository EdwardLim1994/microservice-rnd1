# Escalation — Sprint v0.1.0 (hr-leave-payroll-platform)
# Urgency: RESOLVED — see per-item

## Item 1 — Credential delivery mechanism [RESOLVED 2026-08-10]
Raised by: Solution Architect (`adr-3.md`)
Context: KAN-2 requires getting a generated password to a new employee. No email-sending capability exists anywhere in this repo.
Options: A) self-hosted SMTP relay, B) transactional email provider, C) mock — show credentials in a success dialog to HR Admin.
**Edward's decision: Option C** — "mock send email by showing email and password in dialog after success register employee." No real email provider needed in v0.1.0. See `adr-3.md` (updated).
Blocking: NO (resolved) — unblocks `employee-grpc`/KAN-13 completion.

## Item 2 — PDPA baseline vs. "no extra regulatory controls" scope
Raised by: Security Engineer (`compliance-assessment` override rule)
Context: During requirements elicitation, Edward said "keep it simple, no extra regulatory controls" (constraints Q6). But `compliance-assessment`'s override rule makes PII/financial-data compliance requirements non-negotiable Must Ship regardless of scope preference — employee PII and payroll data trigger a PDPA (Malaysia) baseline.
Options:
  A) Ship only the PDPA baseline (encryption at rest, access restriction to owner/HR Admin, audit log on PII writes) — small, contained addition to KAN-2/4/5. Defer the heavier PDPA workflows (data subject access/erasure requests, retention automation).
  B) Skip PDPA baseline entirely, honoring Edward's "keep it simple" literally, accept the compliance gap as a known risk for this POC.
Recommendation: Option A — the baseline is a handful of AC (already written into KAN-2/4/5's security AC sections), not a heavy compliance program; Option B leaves plaintext PII/payroll data in a way that would need retrofitting later anyway.
Blocking: NO — planning has proceeded with Option A already reflected in the PRD/specs/tasks. Flagging so Edward can override to Option B if that's genuinely preferred.

## Item 3 — KAN-6 (Notifications) scores "Should Ship", not "Must Ship" [RESOLVED 2026-08-10]
Raised by: PM (`task-prioritisation`, see `sprint-v0.1.0-priority/priority-table.md`)
Context: Weighted priority score for KAN-6 is 48.7% (Should Ship band), below the other 4 stories (76-82%, Must Ship).
**Edward's decision: keep KAN-6 in v0.1.0 scope** (Option A — recommended option, confirmed).
Blocking: NO.
