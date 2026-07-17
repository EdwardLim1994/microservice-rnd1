import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    // hr-portal is fronted by Traefik under its own *.localhost host (see
    // services/apollo/docker-compose.yml's `graphql.localhost` for the same pattern) — unlike
    // Vitest/Node (see api/user-registration/register.test.ts's comment), Cypress runs in a real
    // browser, which does resolve arbitrary *.localhost subdomains per RFC 6761.
    baseUrl: process.env.CLUSTER_URL ?? 'http://hr-portal.localhost',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
  },
})
