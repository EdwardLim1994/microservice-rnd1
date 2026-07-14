import { defineConfig } from 'cypress'

// mfe1 and Apollo Router each keep their own direct host-port publish alongside Traefik's
// `*.localhost` routing (services/traefik/CLAUDE.md: "Traefik is additive, not a replacement for
// direct localhost:<port> access") — default to those direct ports rather than
// `mfe1.localhost`/`graphql.localhost`. Two independent reasons this matters here, not just
// preference: (1) a single shared default couldn't serve both "visit a page" and "call the
// GraphQL API" anyway, since they're different hosts; (2) Node's own `dns.lookup` (which
// `e2e/api/**/*.test.ts`'s Vitest suite runs under, unlike Cypress's browser-based network stack)
// does not resolve arbitrary `*.localhost` subdomains the way browsers/curl/Bun do per RFC 6761 —
// confirmed empirically (`node -e 'require("dns").lookup("graphql.localhost", console.log)'`
// throws `ENOTFOUND`, while plain `"localhost"` resolves fine, Node only special-cases that exact
// string). Direct ports sidestep that gap entirely and don't depend on Traefik being reachable at
// all for local runs.
export default defineConfig({
  // GRAPHQL_URL is public, non-sensitive config (just a URL) — exposed to spec code via
  // Cypress.expose() rather than Cypress.env(), which allowCypressEnv: false below disables
  // entirely (Cypress.env() readable by any browser code is deprecated, see
  // https://on.cypress.io/env and https://on.cypress.io/expose).
  allowCypressEnv: false,
  e2e: {
    baseUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    expose: {
      GRAPHQL_URL: process.env.GRAPHQL_URL ?? 'http://localhost:4000',
    },
  },
})
