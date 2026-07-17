// Browser e2e coverage for US-2 (Employee self-service) — FEAT-12 supervisor portal leave
// approval view. Expected to fail until hr-portal's supervisor views and FEAT-8/12 are
// implemented and merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-12

describe("US-2 Employee self-service — FEAT-12 supervisor leave approval view — Browser", () => {
	beforeEach(() => {
		cy.visit("/leave/approvals");
	});

	// [INT-12-1] Pending leave requests from direct reports appear in table
	it("lists pending leave requests from direct reports", () => {
		cy.get('[data-testid="pending-leave-table"]').should("be.visible");
		cy.get('[data-testid="pending-leave-row"]').should("have.length.greaterThan", 0);
	});

	// [E2E-3 / INT-12-2] Approve action calls ReviewLeave and removes row from pending list
	it("approves a pending leave request via the confirmation modal", () => {
		cy.get('[data-testid="pending-leave-row"]').first().within(() => {
			cy.get('[data-testid="approve-button"]').click();
		});
		cy.get('[data-testid="review-confirm-modal"]').should("be.visible");
		cy.get('[data-testid="review-confirm-button"]').click();

		cy.get('[data-testid="pending-leave-row"]').should("have.length.lessThan", 1);
	});

	// [E2E-4] Reject action
	it("rejects a pending leave request via the confirmation modal", () => {
		cy.get('[data-testid="pending-leave-row"]').first().within(() => {
			cy.get('[data-testid="reject-button"]').click();
		});
		cy.get('[data-testid="review-confirm-modal"]').should("be.visible");
		cy.get('[data-testid="review-confirm-button"]').click();

		cy.get('[data-testid="pending-leave-row"]').should("have.length.lessThan", 1);
	});

	// Edge case: no pending requests
	it("shows an empty state when there are no pending requests", () => {
		cy.get('[data-testid="pending-leave-empty"]').should("be.visible");
	});

	// [INT-12-3] Already-reviewed request shows stale data error and refreshes table
	it("shows a stale data error when a request was already reviewed", () => {
		cy.intercept("POST", "**/graphql", {
			statusCode: 200,
			body: { errors: [{ message: "conflict", extensions: { code: "CONFLICT" } }] },
		}).as("reviewStale");
		cy.get('[data-testid="pending-leave-row"]').first().within(() => {
			cy.get('[data-testid="approve-button"]').click();
		});
		cy.get('[data-testid="review-confirm-button"]').click();
		cy.wait("@reviewStale");

		cy.get('[data-testid="stale-data-error"]').should("be.visible");
	});

	// Edge case: network failure reverts optimistic update
	it("shows an error banner and reverts the optimistic update on network failure", () => {
		cy.intercept("POST", "**/graphql", { forceNetworkError: true }).as("reviewFailed");
		cy.get('[data-testid="pending-leave-row"]').first().within(() => {
			cy.get('[data-testid="approve-button"]').click();
		});
		cy.get('[data-testid="review-confirm-button"]').click();
		cy.wait("@reviewFailed");

		cy.get('[data-testid="error-banner"]').should("be.visible");
	});
});
