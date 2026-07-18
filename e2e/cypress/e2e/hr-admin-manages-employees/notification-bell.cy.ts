// Browser e2e coverage for US-1 (HR Admin manages employees) — FEAT-6 in-app notification (new
// payslip available). Expected to fail until hr-portal (apps/hr-portal) and FEAT-3/FEAT-6 are
// implemented and merged. Design reference: claude.ai/design/p/172c2a11-5f37-4fa7-8a42-5dd734ebf3a1
// (HR Portal.dc.html)
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-1 / FEAT-6

describe('US-1 HR Admin manages employees — FEAT-6 notification bell — Browser', () => {
  beforeEach(() => {
    // / has a `beforeLoad: requireSession` route guard (apps/hr-portal/src/routes.tsx) that
    // throws a redirect to /login when no session exists — with no session ever seeded here,
    // every visit hit that redirect during route load and hung the run indefinitely instead of
    // failing fast (same root cause diagnosed in leave-approval-view.cy.ts's own comment).
    cy.visit('/', {
      onBeforeLoad(win) {
        win.localStorage.setItem('currentEmployeeId', 'test-employee')
        win.localStorage.setItem('accessToken', 'test-access-token')
      },
    })
  })

  // [E2E-2] Employee sees a bell notification when a new payslip is available
  it('shows an unread badge and the payslip-ready message after payslip generation', () => {
    cy.get('[data-testid="notification-bell"]').click()
    cy.get('[data-testid="notification-badge"]').should('be.visible')
    cy.get('[data-testid="notification-dropdown"]').should('contain', 'payslip is ready')
  })

  it('marks a notification as read and clears the badge when all are read', () => {
    cy.get('[data-testid="notification-bell"]').click()
    cy.get('[data-testid="notification-item"]').first().click()
    cy.get('[data-testid="notification-badge"]').should('not.exist')
  })

  // Edge case: no notifications
  it('shows an empty dropdown state when there are no notifications', () => {
    cy.get('[data-testid="notification-bell"]').click()
    cy.get('[data-testid="notification-dropdown"]').should('contain', 'No notifications')
  })

  // Edge case: network failure fetching notifications
  it('shows an error state in the dropdown on network failure', () => {
    cy.intercept('POST', '**/graphql', { forceNetworkError: true }).as('notificationsFailed')
    cy.get('[data-testid="notification-bell"]').click()
    cy.get('[data-testid="notification-error"]').should('be.visible')
  })
})
