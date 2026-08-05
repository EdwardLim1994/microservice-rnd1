# E2E Tests

Framework: Vitest (vitest.config.ts at root of test/e2e/)
Location: test/e2e/api/
Scope: API-level end-to-end tests against a running local cluster (tilt up)

## Conventions (to be established)
- Tests target Apollo Router at http://localhost (via Traefik)
- Each test file corresponds to one GraphQL operation or gRPC flow
- Test data setup and teardown is the responsibility of each test
- Tests run against local k3d cluster — cluster must be running before test execution
- Run with: cd test/e2e && bun vitest run

## Status
Infrastructure present. Test cases not yet written.
First tests to be added: TBD once the first reference backend service exists again
