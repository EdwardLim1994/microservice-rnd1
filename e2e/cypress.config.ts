import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // hr-portal is fronted by Traefik under its own *.localhost host (see
    // services/apollo/docker-compose.yml's `graphql.localhost` for the same pattern), and the
    // browser Cypress drives does resolve arbitrary *.localhost subdomains per RFC 6761 — but
    // Cypress's own pre-flight "is this server running" check runs in its Node process first,
    // before any browser is launched, and Node does NOT resolve *.localhost subdomains the way a
    // browser does (same gap as Vitest/Node — see api/user-registration/register.test.ts's
    // comment), so the plain `bun run test:e2e` (no CLUSTER_URL override) always failed at that
    // check with "Cypress could not verify that this server is running". Defaulting to
    // hr-portal's own published port sidesteps Traefik/DNS entirely; set CLUSTER_URL to point at
    // a real *.localhost/deployed host instead when that routing path itself needs exercising.
    baseUrl: process.env.CLUSTER_URL ?? 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    // On this host (headless Electron under Xvfb on ARM64), Cypress's default on-failure
    // screenshot capture crashes with a raw "EFAULT: bad address in system call argument, write"
    // instead of writing the file — every failing test reports that instead of its real
    // assertion error. Screenshots aren't needed for CI's pass/fail signal; the terminal
    // assertion output already has what matters.
    screenshotOnRunFailure: false,
  },
})
