# ADR-3: Credential delivery mechanism
# Date: 2026-08-10
# Status: Accepted (superseded original "email" framing per Edward's Stage 7 decision)

## Context
KAN-2 requires getting a generated password to a new employee. No email-sending capability exists anywhere in this repo today (`packages/server` has plugins for Authentik, Redis, Meilisearch, MinIO, OTEL — no mail plugin; no SMTP/transactional-email service under `services/*`), and building one is a real vendor/infra decision (see Options A/B below, considered before Edward's decision).

## Options Considered
### Option A: Self-hosted SMTP relay (new `services/*` chart, e.g. Postfix or Maddy)
No external account/API key needed, but real deliverability risk (SPF/DKIM/DMARC, fresh-IP reputation) against personal-email providers for a proof-of-concept.

### Option B: Transactional email provider (e.g. SES, Postmark, Resend) via a new `MailPlugin`
Reliable deliverability, but a new external vendor account (cost, ownership) needing Edward's sign-off.

### Option C: Mock delivery — show credentials in a success dialog (chosen)
No email infrastructure at all. On successful registration, `hr-portal` shows a one-time success dialog to HR Admin displaying the employee's personal email + generated password, for HR Admin to relay manually (out of system, e.g. verbally or via their own channel).
- Zero new infrastructure, zero vendor dependency — matches "keep it simple first" steer.
- Trade-off: HR Admin now transiently sees the employee's plaintext password (a new exposure that a real email flow wouldn't have) — accepted for v1 as a POC-appropriate simplification, not carried into a production credential flow without revisiting.

## Decision
Option C, per Edward's explicit Stage 7 decision: "mock send email by showing email and password in dialog after success register employee." No real email provider is integrated in v0.1.0.

## Consequences
- Removes the KAN-2/`employee-grpc` blocker entirely — no vendor decision needed, no `MailPlugin` to build.
- `employee-subgraph`'s `registerEmployee` mutation result type must return the generated password in its success payload (once, not retrievable again) for `hr-portal` to render the dialog — a deliberate exception to "never return secrets in API responses," scoped narrowly to this one mutation's immediate response, not persisted or logged.
- The dialog is single-view (not re-fetchable) and the password is never persisted in `hr-portal` state beyond the dialog's lifetime — HR Admin must copy/relay it before dismissing.
- If this repo ever moves this feature beyond POC, revisit: real email delivery removes the HR-Admin-sees-employee-password exposure this mock introduces.

## Related Decisions
[[ADR-1]] (employee-grpc is where this plugs in)
