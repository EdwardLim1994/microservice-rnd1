# Test Data Strategy — KAN-2 (Employee Registration & Profile Management)

| Data state | Store | Source |
|---|---|---|
| Empty employee list | PostgreSQL (`employee-infra`) | fresh DB, no seed |
| One HR Admin (implicit root, no employee row) | N/A | config/env, not a DB row per Problem Statement |
| Existing employee (for duplicate-email test) | PostgreSQL | fixture: `employee-fixture-basic.sql` |
| Existing employee with a supervisor already assigned (self-ref chain) | PostgreSQL | fixture: `employee-fixture-with-supervisor.sql` |
| Authentik test realm/user | Authentik (services/authentik) | seeded via Authentik admin API in test setup, torn down after |
| Mocked email provider | N/A (mocked) | MSW/mock transport intercepting the send call — no real email sent in tests |
