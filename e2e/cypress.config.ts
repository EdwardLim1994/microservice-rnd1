import { defineConfig } from 'cypress'

// Every browser-facing service in this repo is routed through Traefik on a distinct
// `*.localhost` Host (see services/traefik/CLAUDE.md) — there is no bare-`localhost` route for
// either mfe1 or Apollo Router, so a single `CLUSTER_URL` can't serve both "visit a page" and
// "call the GraphQL API" here. `FRONTEND_URL`/`GRAPHQL_URL` replace that one shared default with
// the two actual routed hosts.
export default defineConfig({
  e2e: {
    baseUrl: process.env.FRONTEND_URL ?? 'http://mfe1.localhost',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    env: {
      GRAPHQL_URL: process.env.GRAPHQL_URL ?? 'http://graphql.localhost',
    },
  },
})
