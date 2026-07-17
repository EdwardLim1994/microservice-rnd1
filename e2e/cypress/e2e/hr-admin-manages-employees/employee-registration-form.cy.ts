// Browser e2e coverage for US-1 (HR Admin manages employees) — FEAT-5 employee registration
// form. Expected to fail until hr-portal (apps/hr-portal) and FEAT-1/FEAT-5 are implemented and
// merged. Design reference: claude.ai/design/p/172c2a11-5f37-4fa7-8a42-5dd734ebf3a1
// (HR Portal.dc.html)
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-1 / FEAT-5

describe('US-1 HR Admin manages employees — FEAT-5 employee registration form — Browser', () => {
  beforeEach(() => {
    cy.visit('/employees')
    cy.get('[data-testid="register-employee-button"]').click()
  })

  // [E2E-1] Valid registration displays the temporary password in a copyable field
  it('registers an employee and shows a copyable temporary password on success', () => {
    const employeeId = `EMP-CY-${Date.now()}`

    cy.get('[data-testid="fullName-input"]').type('Marie Curie')
    cy.get('[data-testid="employeeId-input"]').type(employeeId)
    cy.get('[data-testid="role-select"]').select('Software Engineer')
    cy.get('[data-testid="department-select"]').select('Engineering')
    cy.get('[data-testid="grossSalary-input"]').type('5000')
    cy.get('[data-testid="submit-button"]').click()

    cy.get('[data-testid="temporary-password-field"]').should('be.visible')
    cy.get('[data-testid="copy-password-button"]').should('be.visible')
  })

  it('disables the submit button while the request is in flight', () => {
    cy.get('[data-testid="fullName-input"]').type('Niels Bohr')
    cy.get('[data-testid="employeeId-input"]').type(`EMP-CY-${Date.now()}`)
    cy.get('[data-testid="grossSalary-input"]').type('5000')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="submit-button"]').should('be.disabled')
  })

  // Edge case: supervisor dropdown empty
  it('allows submission without a supervisor when none are available', () => {
    cy.get('[data-testid="supervisor-dropdown"]').should('contain', 'No supervisors available')
    cy.get('[data-testid="fullName-input"]').type('Alan Turing')
    cy.get('[data-testid="employeeId-input"]').type(`EMP-CY-${Date.now()}`)
    cy.get('[data-testid="grossSalary-input"]').type('5000')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="temporary-password-field"]').should('be.visible')
  })

  // Edge case: duplicate employeeId
  it('shows an inline error on the employeeId field for a conflict', () => {
    const employeeId = `EMP-CY-DUP-${Date.now()}`
    cy.get('[data-testid="fullName-input"]').type('Duplicate One')
    cy.get('[data-testid="employeeId-input"]').type(employeeId)
    cy.get('[data-testid="grossSalary-input"]').type('5000')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="temporary-password-field"]').should('be.visible')

    cy.get('[data-testid="register-employee-button"]').click()
    cy.get('[data-testid="fullName-input"]').type('Duplicate Two')
    cy.get('[data-testid="employeeId-input"]').type(employeeId)
    cy.get('[data-testid="grossSalary-input"]').type('4000')
    cy.get('[data-testid="submit-button"]').click()
    cy.get('[data-testid="employeeId-error"]').should('be.visible')
  })

  // Edge case: network failure preserves form state
  it('shows a generic error banner and preserves form data on network failure', () => {
    cy.intercept('POST', '**/graphql', { forceNetworkError: true }).as('registerFailed')
    cy.get('[data-testid="fullName-input"]').type('Network Failure')
    cy.get('[data-testid="employeeId-input"]').type(`EMP-CY-${Date.now()}`)
    cy.get('[data-testid="grossSalary-input"]').type('5000')
    cy.get('[data-testid="submit-button"]').click()
    cy.wait('@registerFailed')
    cy.get('[data-testid="error-banner"]').should('be.visible')
    cy.get('[data-testid="fullName-input"]').should('have.value', 'Network Failure')
  })
})
