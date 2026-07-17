import { type AuthentikClient, BaseUseCase } from "server";

export interface RequestPasswordResetInput {
	email: string;
}

export interface AcknowledgementResult {
	success: boolean;
	message?: string;
}

/**
 * FEAT-10 step 1 — employee-subgraph.EmployeeService.ResetPassword's RequestReset. Always
 * returns success, even for an unregistered email, so the response never leaks account
 * existence — errors from Authentik (other than "no user found", which AuthentikClient itself
 * absorbs) still propagate as a genuine failure.
 */
export default class RequestPasswordResetUseCase extends BaseUseCase<
	{ input: RequestPasswordResetInput },
	AcknowledgementResult
> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ input }: { input: RequestPasswordResetInput }): Promise<AcknowledgementResult> {
		await this.authentik.requestPasswordReset(input.email);
		return { success: true };
	}
}
