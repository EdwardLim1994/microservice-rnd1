import { expect, test } from "@rstest/core";
import { GraphQLError } from "graphql";
import { AuthentikInvalidTokenError, AuthentikPasswordPolicyError, type AuthentikClient } from "server";
import ConfirmPasswordResetUseCase from "../../src/usecases/ConfirmPasswordResetUseCase";

function createMockAuthentik(impl: (token: string, password: string) => Promise<void>) {
	return { confirmPasswordReset: impl } as unknown as AuthentikClient;
}

function getGraphQLError(thrown: unknown): GraphQLError {
	expect(thrown).toBeInstanceOf(GraphQLError);
	return thrown as GraphQLError;
}

test("valid token and password returns success", async () => {
	const useCase = new ConfirmPasswordResetUseCase({
		authentik: createMockAuthentik(async () => {}),
	});

	const result = await useCase.execute({ input: { resetToken: "tok-1", newPassword: "N3wP@ssword!" } });

	expect(result.success).toBe(true);
});

// [INT-10-3] Invalid reset token returns invalid token error
test("invalid reset token returns INVALID_TOKEN error", async () => {
	const useCase = new ConfirmPasswordResetUseCase({
		authentik: createMockAuthentik(async () => {
			throw new AuthentikInvalidTokenError({ component: "ak-stage-access-denied" });
		}),
	});

	let thrown: unknown;
	try {
		await useCase.execute({ input: { resetToken: "bad-token", newPassword: "N3wP@ssword!" } });
	} catch (error) {
		thrown = error;
	}

	expect(String(getGraphQLError(thrown).extensions?.code)).toBe("INVALID_TOKEN");
});

// [INT-10-4] Password not meeting policy returns policy violation error
test("password not meeting policy returns PASSWORD_POLICY_VIOLATION", async () => {
	const useCase = new ConfirmPasswordResetUseCase({
		authentik: createMockAuthentik(async () => {
			throw new AuthentikPasswordPolicyError({ component: "ak-stage-prompt" });
		}),
	});

	let thrown: unknown;
	try {
		await useCase.execute({ input: { resetToken: "tok-1", newPassword: "weak" } });
	} catch (error) {
		thrown = error;
	}

	expect(String(getGraphQLError(thrown).extensions?.code)).toBe("PASSWORD_POLICY_VIOLATION");
});

test("Authentik unreachable returns INTERNAL_ERROR", async () => {
	const useCase = new ConfirmPasswordResetUseCase({
		authentik: createMockAuthentik(async () => {
			throw new Error("network error");
		}),
	});

	let thrown: unknown;
	try {
		await useCase.execute({ input: { resetToken: "tok-1", newPassword: "N3wP@ssword!" } });
	} catch (error) {
		thrown = error;
	}

	expect(String(getGraphQLError(thrown).extensions?.code)).toBe("INTERNAL_ERROR");
});
