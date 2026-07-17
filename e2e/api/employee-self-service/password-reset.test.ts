import { describe, expect, it } from "vitest";

// Black-box e2e coverage for US-2 (Employee self-service), driven entirely through Apollo
// Router. Expected to fail until FEAT-10 (requestPasswordReset/confirmPasswordReset — not yet
// implemented) is live.
// See .openspec/requirements/release/0.1.0/requirements.yaml — US-2 / FEAT-10 /
// employee-subgraph.api.graphql

const GRAPHQL_URL = process.env.GRAPHQL_URL ?? "http://localhost:4000";
const GRAPHQL_ENDPOINT = `${GRAPHQL_URL}/graphql`;

const REQUEST_PASSWORD_RESET_MUTATION = `
  mutation RequestPasswordReset($input: RequestPasswordResetInput!) {
    requestPasswordReset(input: $input) {
      success
      message
    }
  }
`;

const CONFIRM_PASSWORD_RESET_MUTATION = `
  mutation ConfirmPasswordReset($input: ConfirmPasswordResetInput!) {
    confirmPasswordReset(input: $input) {
      success
      message
    }
  }
`;

async function graphql(query: string, variables: Record<string, unknown>) {
	const res = await fetch(GRAPHQL_ENDPOINT, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	return { status: res.status, body: await res.json() };
}

describe("US-2 Employee self-service — FEAT-10 password reset — API", () => {
	// [INT-10-1 / E2E-6] Valid email triggers Authentik reset email and returns success
	it("requesting a reset for a registered email returns success", async () => {
		const { status, body } = await graphql(REQUEST_PASSWORD_RESET_MUTATION, {
			input: { email: "e2e-registered@example.com" },
		});

		expect(status).toBe(200);
		expect(body.errors).toBeUndefined();
		expect(body.data?.requestPasswordReset?.success).toBe(true);
	});

	// [INT-10-2] Unregistered email returns success without leaking account existence
	it("requesting a reset for an unregistered email still returns success", async () => {
		const { body } = await graphql(REQUEST_PASSWORD_RESET_MUTATION, {
			input: { email: `unregistered-${Date.now()}@example.com` },
		});

		expect(body.errors).toBeUndefined();
		expect(body.data?.requestPasswordReset?.success).toBe(true);
	});

	// [INT-10-3] Invalid reset token returns invalid token error
	it("confirming with an invalid reset token returns an error", async () => {
		const { body } = await graphql(CONFIRM_PASSWORD_RESET_MUTATION, {
			input: { resetToken: "not-a-real-token", newPassword: "Correct-Horse-Battery-1!" },
		});

		expect(body.errors).toBeDefined();
	});

	// [INT-10-4] Password not meeting policy returns validation error
	it("confirming with a weak password returns a policy validation error", async () => {
		const { body } = await graphql(CONFIRM_PASSWORD_RESET_MUTATION, {
			input: { resetToken: "some-token", newPassword: "password" },
		});

		expect(body.errors).toBeDefined();
	});
});
