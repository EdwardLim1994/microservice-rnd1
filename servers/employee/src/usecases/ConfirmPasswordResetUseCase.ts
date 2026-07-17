import { GraphQLError } from "graphql";
import {
	AuthentikInvalidTokenError,
	AuthentikPasswordPolicyError,
	type AuthentikClient,
	BaseUseCase,
} from "server";
import type { AcknowledgementResult } from "./RequestPasswordResetUseCase";

export interface ConfirmPasswordResetInput {
	resetToken: string;
	newPassword: string;
}

/**
 * FEAT-10 step 2 — employee-subgraph.EmployeeService.ResetPassword's ConfirmReset. Maps
 * AuthentikClient's two distinct failure modes (invalid/expired token vs. password-policy
 * violation) to their own GraphQL error codes per the OpenSpec edge cases.
 */
export default class ConfirmPasswordResetUseCase extends BaseUseCase<
	{ input: ConfirmPasswordResetInput },
	AcknowledgementResult
> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ input }: { input: ConfirmPasswordResetInput }): Promise<AcknowledgementResult> {
		try {
			await this.authentik.confirmPasswordReset(input.resetToken, input.newPassword);
		} catch (error) {
			if (error instanceof AuthentikInvalidTokenError) {
				throw new GraphQLError("resetToken is invalid or expired", {
					extensions: { code: "INVALID_TOKEN" },
				});
			}
			if (error instanceof AuthentikPasswordPolicyError) {
				throw new GraphQLError("newPassword does not meet the password policy", {
					extensions: { code: "PASSWORD_POLICY_VIOLATION" },
				});
			}
			throw new GraphQLError("failed to confirm password reset", {
				extensions: { code: "INTERNAL_ERROR" },
				originalError: error instanceof Error ? error : undefined,
			});
		}
		return { success: true };
	}
}
