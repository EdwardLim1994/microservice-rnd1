// Browser e2e coverage for US-01 (User Registration). Expected to fail until FEAT-04 (Register UI)
// is implemented and merged into this branch, on top of FEAT-01/FEAT-02.
// See .openspec/requirements/release/integration-testing/requirements.yaml — US-01
//
// data-testid contract (matches frontends/mfe1/tests/integration/register.test.tsx, merged via
// feat/20-register-ui): email-input, password-input, submit-button, email-error, password-error,
// success-message, error-message.

function uniqueEmail() {
  return `e2e-register-${Date.now()}@example.com`
}

describe('US-01 User Registration — Browser', () => {
  beforeEach(() => {
    cy.visit('/register')
  })

  // [E2E-US01-01] Successful registration
  it('shows a success message on valid registration', () => {
    cy.get('[data-testid="email-input"]').should('be.visible').type(uniqueEmail())
    cy.get('[data-testid="password-input"]').type('A-Valid-Password-123!')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="success-message"]').should('be.visible')
  })

  // [E2E-US01-02] Duplicate email
  it('shows a duplicate email error when the email is already registered', () => {
    const email = uniqueEmail()

    cy.get('[data-testid="email-input"]').type(email)
    cy.get('[data-testid="password-input"]').type('A-Valid-Password-123!')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="success-message"]').should('be.visible')

    cy.visit('/register')
    cy.get('[data-testid="email-input"]').type(email)
    cy.get('[data-testid="password-input"]').type('A-Valid-Password-123!')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="error-message"]').should('contain', 'already')
  })

  // [E2E-US01-03] Empty email field
  it('shows inline validation and does not submit when email is empty', () => {
    cy.get('[data-testid="password-input"]').type('A-Valid-Password-123!')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="email-error"]').should('be.visible')
    cy.get('[data-testid="success-message"]').should('not.exist')
  })

  // [E2E-US01-04] Empty password field
  it('shows inline validation and does not submit when password is empty', () => {
    cy.get('[data-testid="email-input"]').type(uniqueEmail())
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="password-error"]').should('be.visible')
    cy.get('[data-testid="success-message"]').should('not.exist')
  })
})
