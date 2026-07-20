// Browser e2e coverage for FEAT-2 (List employees).
// Scope: user action -> GraphQL call fires -> UI handles response. Not visual/pixel testing.
// See .openspec/requirements/release/v0.1.0/requirements.yaml — US-1 / FEAT-2

describe('FEAT-2 List employees — e2e', () => {
  beforeEach(() => {
    cy.visit('/employees')
  })

  // Acceptance criterion: HR Admin can list all employees including supervisor assignment
  it('renders the employee table with resolved supervisor name and status badge', () => {
    cy.intercept('POST', '/graphql', {
      body: {
        data: {
          employees: [
            {
              id: '1',
              firstName: 'Jane',
              lastName: 'Doe',
              email: 'jane@example.com',
              grossSalary: 5000,
              supervisor: { id: '2', firstName: 'Sam', lastName: 'Boss' },
            },
          ],
        },
      },
    }).as('employees')

    cy.wait('@employees')
    cy.get('[data-testid="employee-row-1"]').should('contain', 'Jane')
    cy.get('[data-testid="employee-row-1"]').should('contain', 'Sam Boss')
    cy.get('[data-testid="employee-status-badge-1"]').should('be.visible')
  })

  // Edge case: employees with no supervisor show em dash
  it('shows an em dash in the Supervisor column when no supervisor is assigned', () => {
    cy.intercept('POST', '/graphql', {
      body: {
        data: {
          employees: [
            { id: '1', firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', grossSalary: 5000, supervisor: null },
          ],
        },
      },
    }).as('employees')

    cy.wait('@employees')
    cy.get('[data-testid="employee-row-1"]').should('contain', '—')
  })

  // Empty state — no employees registered yet
  it('renders an empty table body without crashing when there are no employees', () => {
    cy.intercept('POST', '/graphql', { body: { data: { employees: [] } } }).as('employees')

    cy.wait('@employees')
    cy.get('[data-testid="employees-table"]').should('be.visible')
    cy.get('[data-testid^="employee-row-"]').should('not.exist')
  })
})
