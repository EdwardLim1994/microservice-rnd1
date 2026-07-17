// Browser e2e coverage for US-2 (Employee self-service) — FEAT-14 custom password reset UI.
// Expected to fail until hr-portal's password reset pages and FEAT-10/14 are implemented and
// merged.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-14

describe("US-2 Employee self-service — FEAT-14 custom password reset UI — Browser", () => {
	describe("Step 1 — Forgot Password", () => {
		beforeEach(() => {
			cy.visit("/forgot-password");
		});

		// [E2E-6] Valid email submission shows success message
		it("shows a success message regardless of account existence", () => {
			cy.get('[data-testid="email-input"]').type("e2e-user@example.com");
			cy.get('[data-testid="send-reset-link-button"]').click();

			cy.get('[data-testid="reset-request-success"]').should(
				"contain",
				"a reset link has been sent",
			);
		});

		it("disables the submit button while the request is in flight", () => {
			cy.get('[data-testid="email-input"]').type("e2e-user@example.com");
			cy.get('[data-testid="send-reset-link-button"]').click();
			cy.get('[data-testid="send-reset-link-button"]').should("be.disabled");
		});

		// [INT-14-1 edge case] invalid email format
		it("shows inline validation for an invalid email format", () => {
			cy.get('[data-testid="email-input"]').type("not-an-email");
			cy.get('[data-testid="send-reset-link-button"]').click();

			cy.get('[data-testid="email-format-error"]').should("be.visible");
		});

		it("shows a generic error banner when Authentik is unreachable", () => {
			cy.intercept("POST", "**/graphql", { forceNetworkError: true }).as("requestFailed");
			cy.get('[data-testid="email-input"]').type("e2e-user@example.com");
			cy.get('[data-testid="send-reset-link-button"]').click();
			cy.wait("@requestFailed");

			cy.get('[data-testid="error-banner"]').should("be.visible");
		});
	});

	describe("Step 2 — Set New Password", () => {
		beforeEach(() => {
			cy.visit("/reset-password?token=e2e-test-token");
		});

		// [E2E-6] Password updated successfully
		it("shows a success message and login link after a valid reset", () => {
			cy.get('[data-testid="newPassword-input"]').type("Correct-Horse-Battery-1!");
			cy.get('[data-testid="confirmPassword-input"]').type("Correct-Horse-Battery-1!");
			cy.get('[data-testid="set-password-button"]').click();

			cy.get('[data-testid="reset-confirm-success"]').should("contain", "Password updated");
			cy.get('[data-testid="login-link"]').should("be.visible");
		});

		// [INT-14-2] Mismatched passwords shows inline validation before submit
		it("shows inline validation when passwords do not match", () => {
			cy.get('[data-testid="newPassword-input"]').type("Correct-Horse-Battery-1!");
			cy.get('[data-testid="confirmPassword-input"]')
				.type("Different-Password-1!")
				.blur();

			cy.get('[data-testid="password-mismatch-error"]').should("be.visible");
		});

		it("shows the Authentik policy error returned from the API", () => {
			cy.intercept("POST", "**/graphql", {
				statusCode: 200,
				body: {
					errors: [
						{ message: "This password is too common.", extensions: { code: "PASSWORD_POLICY_VIOLATION" } },
					],
				},
			}).as("policyError");
			cy.get('[data-testid="newPassword-input"]').type("password");
			cy.get('[data-testid="confirmPassword-input"]').type("password");
			cy.get('[data-testid="set-password-button"]').click();
			cy.wait("@policyError");

			cy.get('[data-testid="policy-error"]').should("contain", "too common");
		});

		// [INT-14-3] Expired token shows reset link expired message with back link
		it("shows a reset link expired message for an invalid/expired token", () => {
			cy.intercept("POST", "**/graphql", {
				statusCode: 200,
				body: { errors: [{ message: "invalid token", extensions: { code: "INVALID_TOKEN" } }] },
			}).as("expiredToken");
			cy.get('[data-testid="newPassword-input"]').type("Correct-Horse-Battery-1!");
			cy.get('[data-testid="confirmPassword-input"]').type("Correct-Horse-Battery-1!");
			cy.get('[data-testid="set-password-button"]').click();
			cy.wait("@expiredToken");

			cy.get('[data-testid="token-expired-error"]').should("be.visible");
			cy.get('[data-testid="back-to-forgot-password-link"]').should("be.visible");
		});
	});
});
