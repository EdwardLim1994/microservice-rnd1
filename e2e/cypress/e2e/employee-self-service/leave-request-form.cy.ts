// Browser e2e coverage for US-2 (Employee self-service) — FEAT-11 employee portal leave request
// form and status list. Expected to fail until hr-portal's leave views and FEAT-7/11 are
// implemented and merged. Design reference: claude.ai/design/p/172c2a11-5f37-4fa7-8a42-5dd734ebf3a1
// (HR Portal.dc.html)
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-11

describe("US-2 Employee self-service — FEAT-11 leave request form and status list — Browser", () => {
	beforeEach(() => {
		// /leave has a `beforeLoad: requireSession` route guard (apps/hr-portal/src/routes.tsx) that
		// throws a redirect to /login when no session exists — with no session ever seeded here,
		// every visit hit that redirect during route load and hung the run indefinitely instead of
		// failing fast (same root cause diagnosed in leave-approval-view.cy.ts's own comment).
		cy.visit("/leave", {
			onBeforeLoad(win) {
				win.localStorage.setItem("currentEmployeeId", "test-employee");
				win.localStorage.setItem("accessToken", "test-access-token");
			},
		});
	});

	// [E2E-3/4] Valid leave submission appears in history table with Pending badge
	it("submits a leave request and shows it as Pending in the history list", () => {
		cy.get('[data-testid="apply-leave-button"]').click();
		cy.get('[data-testid="leaveType-select"]').select("Annual");
		cy.get('[data-testid="startDate-input"]').type("2026-08-01");
		cy.get('[data-testid="endDate-input"]').type("2026-08-05");
		cy.get('[data-testid="reason-input"]').type("Family vacation");
		cy.get('[data-testid="submit-leave-button"]').click();

		cy.get('[data-testid="leave-history-table"]').should(
			"contain",
			"Family vacation",
		);
		cy.get('[data-testid="leave-status-badge"]').first().should("contain", "Pending");
	});

	it("disables the submit button while the request is in flight", () => {
		cy.get('[data-testid="apply-leave-button"]').click();
		cy.get('[data-testid="leaveType-select"]').select("Medical");
		cy.get('[data-testid="startDate-input"]').type("2026-08-01");
		cy.get('[data-testid="endDate-input"]').type("2026-08-02");
		cy.get('[data-testid="reason-input"]').type("Doctor visit");
		cy.get('[data-testid="submit-leave-button"]').click();
		cy.get('[data-testid="submit-leave-button"]').should("be.disabled");
	});

	// [INT-11-2] End date before start date shows inline validation before submit
	it("shows inline validation when end date is before start date", () => {
		cy.get('[data-testid="apply-leave-button"]').click();
		cy.get('[data-testid="leaveType-select"]').select("Annual");
		cy.get('[data-testid="startDate-input"]').type("2026-08-10");
		cy.get('[data-testid="endDate-input"]').type("2026-08-01");
		cy.get('[data-testid="reason-input"]').type("Invalid range");
		cy.get('[data-testid="submit-leave-button"]').click();

		cy.get('[data-testid="date-range-error"]').should("be.visible");
	});

	// [INT-11-3] Empty history shows empty state message
	it("shows an empty state when there is no leave history", () => {
		cy.get('[data-testid="leave-history-empty"]').should("be.visible");
	});

	// Edge case: network failure preserves form state
	it("shows an error banner and preserves form state on network failure", () => {
		cy.intercept("POST", "**/graphql", { forceNetworkError: true }).as("submitFailed");
		cy.get('[data-testid="apply-leave-button"]').click();
		cy.get('[data-testid="leaveType-select"]').select("Annual");
		cy.get('[data-testid="startDate-input"]').type("2026-08-01");
		cy.get('[data-testid="endDate-input"]').type("2026-08-02");
		cy.get('[data-testid="reason-input"]').type("Network test");
		cy.get('[data-testid="submit-leave-button"]').click();
		cy.wait("@submitFailed");

		cy.get('[data-testid="error-banner"]').should("be.visible");
		cy.get('[data-testid="reason-input"]').should("have.value", "Network test");
	});
});
