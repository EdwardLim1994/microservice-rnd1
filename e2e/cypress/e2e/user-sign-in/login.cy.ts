// Browser e2e coverage for US-02 (User Sign In). Expected to fail until FEAT-06 (Sign In UI) is
// implemented and merged, on top of FEAT-05. Registers a fresh user via a direct GraphQL call as
// setup (no register UI dependency), since login has no other provisioning path in this suite.
// See .openspec/requirements/release/integration-testing/requirements.yaml — US-02
//
// data-testid contract (matches frontends/mfe1/tests/integration/login.test.tsx, merged via
// feat/23-sign-in-ui-token-storage): email-input, password-input, submit-button, email-error,
// password-error, success-message, error-message, storage-error.

const VALID_PASSWORD = 'A-Valid-Password-123!'
const TOKEN_KEYS = ['auth_access_token', 'auth_refresh_token', 'auth_id_token']

// Apollo Router's own direct host-port publish — a different host/port than
// `Cypress.config().baseUrl` (mfe1's own port, for `cy.visit()`), so this can't reuse it (see
// services/traefik/CLAUDE.md and cypress.config.ts's own comment).
const GRAPHQL_URL = `${Cypress.env('GRAPHQL_URL') ?? 'http://localhost:4000'}/graphql`

function uniqueEmail() {
  return `e2e-login-${Date.now()}@example.com`
}

function registerViaApi(email: string, password: string) {
  return cy.request({
    method: 'POST',
    url: GRAPHQL_URL,
    body: {
      query: `mutation Register($email: String!, $password: String!) {
        register(email: $email, password: $password) { success message }
      }`,
      variables: { email, password },
    },
  })
}

describe('US-02 User Sign In — Browser', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  // [E2E-US02-01] Successful sign in
  it('stores the full token set in localStorage on successful sign in', () => {
    const email = uniqueEmail()
    registerViaApi(email, VALID_PASSWORD).then(() => {
      cy.visit('/login')
      cy.get('[data-testid="email-input"]').type(email)
      cy.get('[data-testid="password-input"]').type(VALID_PASSWORD)
      cy.get('[data-testid="submit-button"]').click()
      cy.get('[data-testid="success-message"]').should('be.visible')

      TOKEN_KEYS.forEach((key) => {
        cy.window()
          .its('localStorage')
          .invoke('getItem', key)
          .should('be.a', 'string')
          .and('not.be.empty')
      })
    })
  })

  // [E2E-US02-02] Incorrect password
  it('shows an error and does not write to localStorage on incorrect password', () => {
    const email = uniqueEmail()
    registerViaApi(email, VALID_PASSWORD).then(() => {
      cy.visit('/login')
      cy.get('[data-testid="email-input"]').type(email)
      cy.get('[data-testid="password-input"]').type('wrong-password')
      cy.get('[data-testid="submit-button"]').click()
      cy.get('[data-testid="error-message"]').should('be.visible')

      TOKEN_KEYS.forEach((key) => {
        cy.window().its('localStorage').invoke('getItem', key).should('be.null')
      })
    })
  })

  // [E2E-US02-03] Non-existent email
  it('shows an error and does not write to localStorage for a non-existent email', () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type(uniqueEmail())
    cy.get('[data-testid="password-input"]').type(VALID_PASSWORD)
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="error-message"]').should('be.visible')

    TOKEN_KEYS.forEach((key) => {
      cy.window().its('localStorage').invoke('getItem', key).should('be.null')
    })
  })

  // [E2E-US02-04] Empty fields
  it('shows inline validation and does not submit when fields are empty', () => {
    cy.visit('/login')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="email-error"]').should('be.visible')
    cy.get('[data-testid="password-error"]').should('be.visible')
    cy.get('[data-testid="success-message"]').should('not.exist')
  })
})
