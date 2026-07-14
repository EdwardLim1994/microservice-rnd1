import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient, BaseUseCase } from "server";

interface LoginInput {
	email: string;
	password: string;
}

interface AuthPayload {
	accessToken: string;
	refreshToken: string;
	idToken: string;
}

function isValidTokenResponse(
	token: unknown,
): token is { access_token: string; refresh_token: string; id_token: string } {
	if (typeof token !== "object" || token === null) return false;
	const t = token as Record<string, unknown>;
	return (
		typeof t.access_token === "string" &&
		typeof t.refresh_token === "string" &&
		typeof t.id_token === "string"
	);
}

export default class LoginUseCase extends BaseUseCase<LoginInput, AuthPayload> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ email, password }: LoginInput): Promise<AuthPayload> {
		if (!email || !password) {
			throw new GraphQLError("Email and password are required", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}

		let token: unknown;
		try {
			token = await this.authentik.signIn(email, password);
		} catch (error) {
			if (error instanceof AuthentikApiError && (error.status === 400 || error.status === 401)) {
				// Never echo Authentik's raw error body back to the client — it can leak IdP
				// internals (e.g. which of email/password was wrong), and would let a client
				// distinguish "wrong password" from "no such account".
				throw new GraphQLError("Invalid email or password", {
					extensions: { code: "INVALID_CREDENTIALS" },
				});
			}
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}

		if (!isValidTokenResponse(token)) {
			// Logged server-side only — the client-facing error below must not leak this shape.
			console.error("LoginUseCase: unexpected Authentik token response shape", token);
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}

		return {
			accessToken: token.access_token,
			refreshToken: token.refresh_token,
			idToken: token.id_token,
		};
	}
}
