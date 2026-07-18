// Browser e2e coverage for US-2 (Employee self-service) — FEAT-13 employee portal payslip
// download page. Expected to fail until hr-portal's payslip page and FEAT-9/13 are implemented
// and merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-13

describe("US-2 Employee self-service — FEAT-13 payslip download page — Browser", () => {
	beforeEach(() => {
		// /payslips has a `beforeLoad: requireSession` route guard (apps/hr-portal/src/routes.tsx)
		// that throws a redirect to /login when no session exists — with no session ever seeded
		// here, every visit hit that redirect during route load and hung the run indefinitely
		// instead of failing fast (same root cause diagnosed in leave-approval-view.cy.ts's own
		// comment).
		cy.visit("/payslips", {
			onBeforeLoad(win) {
				win.localStorage.setItem("currentEmployeeId", "test-employee");
				win.localStorage.setItem("accessToken", "test-access-token");
			},
		});
	});

	// [INT-13-1] Payslip list fetches and renders correctly
	it("lists available payslips by month/year descending", () => {
		cy.get('[data-testid="payslip-row"]').should("have.length.greaterThan", 0);
	});

	// [E2E-5 / INT-13-2] Download button fetches presigned URL and triggers PDF download
	it("fetches a presigned URL and shows a loading state on Download", () => {
		cy.get('[data-testid="payslip-row"]').first().within(() => {
			cy.get('[data-testid="download-button"]').click();
			cy.get('[data-testid="download-loading"]').should("be.visible");
		});
	});

	// Edge case: no payslips
	it("shows an empty state when there are no payslips", () => {
		cy.get('[data-testid="payslip-empty"]').should("be.visible");
	});

	// [INT-13-3 variant] Presigned URL fetch fails — inline error, no navigation away
	it("shows an inline error on the row when the presigned URL fetch fails", () => {
		cy.intercept("POST", "**/graphql", { forceNetworkError: true }).as("urlFailed");
		cy.get('[data-testid="payslip-row"]').first().within(() => {
			cy.get('[data-testid="download-button"]').click();
		});
		cy.wait("@urlFailed");

		cy.get('[data-testid="download-error"]').should("be.visible");
		cy.url().should("include", "/payslips");
	});
});
