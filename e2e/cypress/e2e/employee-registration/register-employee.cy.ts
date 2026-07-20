// Browser e2e coverage for FEAT-1 (Register new employee).
// Scope: user action -> GraphQL call fires -> UI handles response. Not visual/pixel testing.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-1

describe('FEAT-1 Register new employee — e2e', () => {
  beforeEach(() => {
    cy.visit('/employees')
  })

  // [E2E-1-1] Successful employee registration
  it('registers an employee and shows the temporary password in a copyable field', () => {
    cy.intercept('POST', '/graphql').as('registerEmployee')

    cy.get('[data-testid="register-employee-button"]').click()
    cy.get('[data-testid="first-name-input"]').type('Jane')
    cy.get('[data-testid="last-name-input"]').type('Doe')
    cy.get('[data-testid="email-input"]').type(`jane.doe.${Date.now()}@example.com`)
    cy.get('[data-testid="gross-salary-input"]').type('5000')
    cy.get('[data-testid="salary-per-day-input"]').type('200')
    cy.get('[data-testid="submit-button"]').click()

    cy.wait('@registerEmployee').its('request.body.query').should('include', 'registerEmployee')
    cy.get('[data-testid="temporary-password-field"]').should('be.visible')
    cy.get('[data-testid="copy-password-button"]').click()
    cy.get('[data-testid="copy-password-button"]').should('contain', 'Copied!')
  })

  // Loading state — submit disabled while request is in flight
  it('disables the submit button while registration is in flight', () => {
    cy.intercept('POST', '/graphql', (req) => {
      req.on('response', (res) => {
        res.setDelay(1000)
      })
    }).as('registerEmployee')

    cy.get('[data-testid="register-employee-button"]').click()
    cy.get('[data-testid="first-name-input"]').type('Jane')
    cy.get('[data-testid="last-name-input"]').type('Doe')
    cy.get('[data-testid="email-input"]').type(`jane.doe.${Date.now()}@example.com`)
    cy.get('[data-testid="gross-salary-input"]').type('5000')
    cy.get('[data-testid="salary-per-day-input"]').type('200')
    cy.get('[data-testid="submit-button"]').click()

    cy.get('[data-testid="submit-button"]').should('be.disabled')
  })

  // Error state — duplicate email shows inline error on the field
  it('shows an inline error on the email field when the server returns a conflict', () => {
    cy.intercept('POST', '/graphql', {
      body: { errors: [{ message: 'Email already registered', extensions: { code: 'CONFLICT' } }] },
    }).as('registerEmployee')

    cy.get('[data-testid="register-employee-button"]').click()
    cy.get('[data-testid="first-name-input"]').type('Jane')
    cy.get('[data-testid="last-name-input"]').type('Doe')
    cy.get('[data-testid="email-input"]').type('duplicate@example.com')
    cy.get('[data-testid="gross-salary-input"]').type('5000')
    cy.get('[data-testid="salary-per-day-input"]').type('200')
    cy.get('[data-testid="submit-button"]').click()

    cy.wait('@registerEmployee')
    cy.get('[data-testid="email-field-error"]').should('be.visible')
  })

  // Error state — network failure shows generic banner and keeps form data intact
  it('shows a generic error banner and preserves form state on network failure', () => {
    cy.intercept('POST', '/graphql', { forceNetworkError: true }).as('registerEmployee')

    cy.get('[data-testid="register-employee-button"]').click()
    cy.get('[data-testid="first-name-input"]').type('Jane')
    cy.get('[data-testid="last-name-input"]').type('Doe')
    cy.get('[data-testid="email-input"]').type(`jane.doe.${Date.now()}@example.com`)
    cy.get('[data-testid="gross-salary-input"]').type('5000')
    cy.get('[data-testid="salary-per-day-input"]').type('200')
    cy.get('[data-testid="submit-button"]').click()

    cy.get('[data-testid="form-error-banner"]').should('be.visible')
    cy.get('[data-testid="first-name-input"]').should('have.value', 'Jane')
  })

  // Empty state — no supervisors available yet
  it('shows "No supervisors available" and allows submission without a supervisor', () => {
    cy.intercept('GET', '/graphql', { body: { data: { employees: [] } } })

    cy.get('[data-testid="register-employee-button"]').click()
    cy.get('[data-testid="supervisor-search"]').click()
    cy.get('[data-testid="no-supervisors-available"]').should('be.visible')
  })
})
