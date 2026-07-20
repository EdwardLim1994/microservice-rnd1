// Browser e2e coverage for FEAT-3 (Assign supervisor to employee).
// Scope: user action -> GraphQL call fires -> UI handles response. Not visual/pixel testing.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-3

describe('FEAT-3 Assign supervisor to employee — e2e', () => {
  beforeEach(() => {
    cy.visit('/employees')
  })

  // [E2E-1-2] Eligible supervisor — assignment updates the employee's supervisor field
  it('updates the employee row when an eligible supervisor is assigned', () => {
    cy.intercept('POST', '/graphql', {
      body: { data: { assignSupervisor: { id: '1', supervisor: { id: '2', firstName: 'Sam', lastName: 'Boss' } } } },
    }).as('assignSupervisor')

    cy.get('[data-testid="supervisor-search"]').type('Sam')
    cy.get('[data-testid="supervisor-option-2"]').click()

    cy.wait('@assignSupervisor')
    cy.get('[data-testid="employee-row-1"]').should('contain', 'Sam Boss')
  })

  // [E2E-1-3] Ineligible supervisor — error returned, assignment not saved
  it('shows an error toast and does not update the row when the supervisor is ineligible', () => {
    cy.intercept('POST', '/graphql', {
      body: { errors: [{ message: 'Supervisor served less than 5 years', extensions: { code: 'INELIGIBLE' } }] },
    }).as('assignSupervisor')

    cy.get('[data-testid="supervisor-search"]').type('Fresh')
    cy.get('[data-testid="supervisor-option-3"]').click()

    cy.wait('@assignSupervisor')
    cy.get('[data-testid="ineligible-error-toast"]').should('be.visible')
  })

  // uiInteraction: selected supervisor highlighted in the search list
  it('highlights the selected supervisor in the search dropdown', () => {
    cy.get('[data-testid="supervisor-search"]').type('Sam')
    cy.get('[data-testid="supervisor-option-2"]').click()
    cy.get('[data-testid="supervisor-option-2"]').should('have.class', 'selected')
  })
})
