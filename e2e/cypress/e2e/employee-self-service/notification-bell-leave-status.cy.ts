// Browser e2e coverage for US-2 (Employee self-service) — FEAT-15 in-app notification for leave
// status changes. Reuses the NotificationBell component from FEAT-6 (US-1) — same data-testid
// conventions as e2e/cypress/e2e/hr-admin-manages-employees/notification-bell.cy.ts. Expected to
// fail until FEAT-8 (reviewLeave, creates the notification) is implemented and merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-15

describe("US-2 Employee self-service — FEAT-15 notification bell (leave status) — Browser", () => {
	beforeEach(() => {
		cy.visit("/");
	});

	// [E2E-3/4] Employee sees a bell notification when their leave status changes
	it("shows an unread badge and the leave decision message after a review", () => {
		cy.get('[data-testid="notification-bell"]').click();
		cy.get('[data-testid="notification-badge"]').should("be.visible");
		cy.get('[data-testid="notification-dropdown"]').should(
			"contain",
			"has been",
		);
	});

	// Click navigates to leave page and marks read
	it("clicking a leave notification marks it read and navigates to the leave page", () => {
		cy.get('[data-testid="notification-bell"]').click();
		cy.get('[data-testid="notification-item"]').first().click();

		cy.url().should("include", "/leave");
		cy.get('[data-testid="notification-bell"]').click();
		cy.get('[data-testid="notification-badge"]').should("not.exist");
	});

	// Edge case: multiple status changes for same leave request show one notification each
	it("shows one notification per status-change event, not deduplicated", () => {
		cy.get('[data-testid="notification-bell"]').click();
		cy.get('[data-testid="notification-item"]').should("have.length.greaterThan", 1);
	});
});
