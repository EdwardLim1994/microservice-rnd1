// Browser e2e coverage for US-03 (User Sign Out). Expected to fail until FEAT-08 (Sign Out UI) is
// implemented and merged, on top of FEAT-07. Registers + signs in a fresh user via direct GraphQL
// calls and seeds localStorage as setup, since sign-out has no other provisioning path here.
// See .openspec/requirements/release/integration-testing/requirements.yaml — US-03
//
// data-testid contract (matches frontends/mfe1/tests/integration/logout.test.tsx, merged via
// feat/26-sign-out-ui): sign-out-button, sign-out-success-message, sign-out-error-message,
// sign-out-network-error-message, sign-out-not-signed-in-message.

const VALID_PASSWORD = 'A-Valid-Password-123!'
const TOKEN_KEYS = ['auth_access_token', 'auth_refresh_token', 'auth_id_token']

function uniqueEmail() {
  return `e2e-logout-${Date.now()}@example.com`
}

function registerAndSignInViaApi(email: string, password: string) {
  return cy
    .request({
      method: 'POST',
      url: `${Cypress.config().baseUrl}/graphql`,
      body: {
        query: `mutation Register($email: String!, $password: String!) {
          register(email: $email, password: $password) { success message }
        }`,
        variables: { email, password },
      },
    })
    .then(() =>
      cy.request({
        method: 'POST',
        url: `${Cypress.config().baseUrl}/graphql`,
        body: {
          query: `mutation Login($email: String!, $password: String!) {
            login(email: $email, password: $password) { accessToken refreshToken idToken }
          }`,
          variables: { email, password },
        },
      }),
    )
}

function seedTokens(tokens: { accessToken: string; refreshToken: string; idToken: string }) {
  cy.window().then((win) => {
    win.localStorage.setItem('auth_access_token', tokens.accessToken)
    win.localStorage.setItem('auth_refresh_token', tokens.refreshToken)
    win.localStorage.setItem('auth_id_token', tokens.idToken)
  })
}

describe('US-03 User Sign Out — Browser', () => {
  beforeEach(() => {
    cy.clearLocalStorage()
  })

  // [E2E-US03-01] Successful sign out
  it('clears localStorage and shows a success message on sign out', () => {
    const email = uniqueEmail()
    registerAndSignInViaApi(email, VALID_PASSWORD).then((response) => {
      const tokens = response.body.data.login
      cy.visit('/logout')
      seedTokens(tokens)
      cy.reload()
      cy.get('[data-testid="sign-out-button"]').click()
      cy.get('[data-testid="sign-out-success-message"]').should('be.visible')

      TOKEN_KEYS.forEach((key) => {
        cy.window().its('localStorage').invoke('getItem', key).should('be.null')
      })
    })
  })

  // [E2E-US03-02] Session invalidated in authentik — using the same token again fails
  it('shows an error but still clears localStorage when the token is already invalidated', () => {
    const email = uniqueEmail()
    registerAndSignInViaApi(email, VALID_PASSWORD).then((response) => {
      const tokens = response.body.data.login
      cy.visit('/logout')
      seedTokens(tokens)
      cy.reload()
      cy.get('[data-testid="sign-out-button"]').click()
      cy.get('[data-testid="sign-out-success-message"]').should('be.visible')

      cy.visit('/logout')
      seedTokens(tokens)
      cy.reload()
      cy.get('[data-testid="sign-out-button"]').click()
      cy.get('[data-testid="sign-out-error-message"]').should('be.visible')

      TOKEN_KEYS.forEach((key) => {
        cy.window().its('localStorage').invoke('getItem', key).should('be.null')
      })
    })
  })

  // [E2E-US03-03] Malformed or missing token
  it('clears localStorage and shows a not-signed-in message when no token is present', () => {
    cy.visit('/logout')
    cy.get('[data-testid="sign-out-button"]').click()
    cy.get('[data-testid="sign-out-not-signed-in-message"]').should('be.visible')

    TOKEN_KEYS.forEach((key) => {
      cy.window().its('localStorage').invoke('getItem', key).should('be.null')
    })
  })
})
