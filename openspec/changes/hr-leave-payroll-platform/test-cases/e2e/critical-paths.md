# E2E Critical Path Design — hr-leave-payroll-platform

Critical paths only (not exhaustive), full stack (browser → Apollo → subgraph → gRPC → PostgreSQL, and for async: → Kafka → Debezium → downstream). Playwright, `test/e2e/`. Run on merge to `main`.

1. **Onboard-to-login**: HR Admin registers an employee → employee receives (test-inbox-captured) credential email → employee logs in via Authentik with the generated password → lands on role-appropriate home. (KAN-2 + KAN-3)
2. **Leave lifecycle, employee path**: Employee logs in → submits an annual leave request → supervisor logs in → sees it in their approval queue → approves → employee logs in → sees decision notification → balance reflects the deduction. (KAN-3 + KAN-4 + KAN-6)
3. **Leave lifecycle, supervisor path**: Supervisor logs in → submits their own leave request → HR Admin logs in → sees it in their queue (not the supervisor's own queue) → approves. (KAN-4)
4. **Unpaid conversion**: Employee with near-exhausted annual balance submits a request exceeding it → approved → excess days confirmed as unpaid in history/balance view. (KAN-4)
5. **Payroll cycle**: Trigger month-end payroll job → employee logs in → sees "payroll generated" notification → opens My Payslips → downloads the PDF → amount reflects any unpaid leave that month. (KAN-5 + KAN-6)
6. **Authorization boundary**: Employee attempts (via direct API call, not just UI) to approve their own leave request → rejected; Supervisor attempts to approve a non-report's request → rejected. (KAN-4 security)
