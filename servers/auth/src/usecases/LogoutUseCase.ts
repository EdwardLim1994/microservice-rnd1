import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient, BaseUseCase } from "server";

interface LogoutInput {
	accessToken: string;
}

interface LogoutPayload {
	success: boolean;
	message: string;
}

export default class LogoutUseCase extends BaseUseCase<LogoutInput, LogoutPayload> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ accessToken }: LogoutInput): Promise<LogoutPayload> {
		if (!accessToken) {
			throw new GraphQLError("Access token is required", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}

		try {
			await this.authentik.logout(accessToken);
		} catch (error) {
			if (error instanceof AuthentikApiError) {
				// Never echo Authentik's raw error body back to the client — same rationale as
				// LoginUseCase's INVALID_CREDENTIALS branch.
				throw new GraphQLError("The provided access token is invalid or has expired", {
					extensions: { code: "INVALID_TOKEN" },
				});
			}
			if (error instanceof TypeError) {
				// Bun's fetch throws a plain TypeError on a genuine transport failure (e.g. connection
				// refused) — distinct from a non-2xx AuthentikApiError above.
				throw new GraphQLError("Authentication service is unavailable", {
					extensions: { code: "AUTHENTIK_UNAVAILABLE" },
				});
			}
			// Logged server-side only, per issue #25's spec — the client-facing error below must not
			// leak this shape.
			console.error("LogoutUseCase: unexpected error from Authentik on logout", error);
			throw new GraphQLError("Unable to sign out. Please try again.", {
				extensions: { code: "LOGOUT_FAILED" },
			});
		}

		return { success: true, message: "Signed out successfully." };
	}
}
