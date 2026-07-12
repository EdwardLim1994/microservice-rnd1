import { beforeAll, describe, expect, test } from 'bun:test';

// Black-box HTTP smoke tests for GitHub issue #19 (Authentik Terraform/Helm configuration) —
// verifies Authentik itself is correctly provisioned (an OAuth2/OIDC application with client
// credentials, an enrollment flow, an authentication flow), not application code. Written
// QA-first, before/alongside the feature — the enrollment-flow test below is EXPECTED TO FAIL
// until issue #19's Terraform/Ansible work actually provisions that flow (see
// services/authentik/ansible/provision.yml, which today only provisions an OAuth2
// Provider/Application/service-account/token — no enrollment flow, see
// services/authentik/CLAUDE.md and servers/auth/CLAUDE.md's "Known v1 limitations").
//
// Uses plain `bun:test` (not rstest) deliberately — this is a real/expected-running-instance
// smoke test with no DI container or application code under test, same rationale
// packages/server/CLAUDE.md gives for rstest being the convention for application code
// specifically.
//
// Requires a running local Authentik: `docker compose up` from services/authentik/ (or the repo
// root, which includes it) — see services/authentik/CLAUDE.md. Skips gracefully (does not
// hard-fail the suite) if AUTHENTIK_URL isn't reachable at all.

// Same env var names servers/auth/.env.sample uses (see services/authentik/CLAUDE.md and
// packages/server/src/plugin/AuthentikPlugin.ts for the conventions these follow).
const AUTHENTIK_URL = process.env.AUTHENTIK_URL ?? 'http://localhost:9000';
const AUTHENTIK_OAUTH_CLIENT_ID = process.env.AUTHENTIK_OAUTH_CLIENT_ID ?? '';
const AUTHENTIK_OAUTH_CLIENT_SECRET = process.env.AUTHENTIK_OAUTH_CLIENT_SECRET ?? '';

// NOT an existing env var anywhere else in the repo yet — servers/auth/.env.sample only has
// AUTHENTIK_URL / AUTHENTIK_OAUTH_CLIENT_ID / AUTHENTIK_OAUTH_CLIENT_SECRET / AUTHENTIK_API_TOKEN.
// Defined here per issue #19's Integration Test Plan (INT-FEAT03-02), since the enrollment flow
// this test checks for has no provisioned slug/env var convention anywhere else yet. Whichever
// Terraform/Ansible change provisions the enrollment flow (this issue's actual feature work)
// should either register it under this exact env var / slug default, or this test (and its
// default below) should be updated to match.
const AUTHENTIK_ENROLLMENT_FLOW_SLUG =
  process.env.AUTHENTIK_ENROLLMENT_FLOW_SLUG ?? 'default-enrollment-flow';

// Reused from servers/auth/CLAUDE.md's documented default-authentication-flow slug — the same one
// AuthentikClient.runAuthenticationFlow() (packages/server/src/plugin/AuthentikPlugin.ts) drives
// for signIn, already provisioned by Authentik out of the box (no Ansible work needed for this
// one).
const AUTHENTICATION_FLOW_SLUG = 'default-authentication-flow';

const REACHABILITY_TIMEOUT_MS = 3000;

// bun:test's test.skipIf(condition) needs `condition` known at registration time (module load),
// before any beforeAll hook actually runs — so the reachability probe itself has to happen at
// module scope via top-level await (Bun's ESM loader supports it), not inside beforeAll.
// beforeAll below still runs, purely to surface a clear console message explaining *why* the
// suite is skipped.
let authentikReachable = false;
try {
  // Same endpoint AuthentikClient.healthCheck() (packages/server/src/plugin/AuthentikPlugin.ts)
  // uses for its own eager reachability check on server startup.
  const response = await fetch(`${AUTHENTIK_URL}/-/health/ready/`, {
    signal: AbortSignal.timeout(REACHABILITY_TIMEOUT_MS),
  });
  authentikReachable = response.ok;
} catch {
  authentikReachable = false;
}

describe('Authentik enrollment & authentication flows (issue #19)', () => {
  beforeAll(() => {
    if (!authentikReachable) {
      console.warn(
        `AUTHENTIK_URL (${AUTHENTIK_URL}) is not reachable — skipping services/authentik ` +
          'integration tests. Run `docker compose up` from services/authentik/ (see ' +
          'services/authentik/CLAUDE.md) to exercise this suite.',
      );
    }
  });

  test.skipIf(!authentikReachable)(
    '[INT-FEAT03-01] Authentik OAuth2 application is reachable via the token endpoint',
    async () => {
      // Client credentials aren't actually a configured grant on this OAuth2 Provider — only
      // authorization_code + refresh_token are provisioned (see servers/auth/CLAUDE.md's "Why
      // signIn isn't the OAuth2 password grant" section), so this call is never expected to mint
      // a real token. It's a reachability/wiring check: the token endpoint must exist and
      // recognize the configured client_id, responding with a well-formed OAuth2 error (e.g.
      // invalid_grant/unauthorized_client) rather than a 404 (application/provider missing
      // entirely) or a 5xx (Authentik itself unhealthy).
      const response = await fetch(`${AUTHENTIK_URL}/application/o/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: AUTHENTIK_OAUTH_CLIENT_ID,
          client_secret: AUTHENTIK_OAUTH_CLIENT_SECRET,
        }),
      });

      expect(response.status).not.toBe(404);
      expect(response.status).toBeLessThan(500);

      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      // A reachable, correctly-provisioned application responds with a structured OAuth2 error
      // body (RFC 6749 section 5.2) even on a rejected grant type — not an empty/opaque failure.
      expect(body).toHaveProperty('error');
    },
  );

  test.skipIf(!authentikReachable)(
    '[INT-FEAT03-02] Enrollment flow exists at AUTHENTIK_ENROLLMENT_FLOW_SLUG',
    async () => {
      const response = await fetch(
        `${AUTHENTIK_URL}/api/v3/flows/executor/${AUTHENTIK_ENROLLMENT_FLOW_SLUG}/?query=`,
        { headers: { Accept: 'application/json' } },
      );

      // EXPECTED TO FAIL until issue #19's feature work provisions this flow — see this file's
      // header comment. A 404 here means the enrollment flow slug doesn't exist yet in Authentik.
      expect(response.status).toBe(200);
    },
  );

  test.skipIf(!authentikReachable)(
    '[INT-FEAT03-03] Authentication flow exists at default-authentication-flow',
    async () => {
      const response = await fetch(
        `${AUTHENTIK_URL}/api/v3/flows/executor/${AUTHENTICATION_FLOW_SLUG}/?query=`,
        { headers: { Accept: 'application/json' } },
      );

      expect(response.status).toBe(200);
    },
  );
});
