import { GraphQLError } from "graphql";
import {
	AUTHENTIK_MUST_CHANGE_PASSWORD_ATTR,
	AuthentikApiError,
	type AuthentikClient,
	BaseUseCase,
} from "server";

interface SignInInput {
	email: string;
	password: string;
}

interface AuthPayload {
	accessToken: string;
	refreshToken: string;
	idToken: string;
	mustChangePassword: boolean;
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

export default class SignInUseCase extends BaseUseCase<SignInInput, AuthPayload> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ email, password }: SignInInput): Promise<AuthPayload> {
		if (!email || !password) {
			throw new GraphQLError("Email and password are required", {
				extensions: { code: "BAD_USER_INPUT" },
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
					extensions: { code: "UNAUTHENTICATED" },
				});
			}
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}

		if (!isValidTokenResponse(token)) {
			// Logged server-side only — the client-facing error below must not leak this shape.
			console.error("SignInUseCase: unexpected Authentik token response shape", token);
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}

		// By this point Authentik has already verified the real password and minted real tokens —
		// a failure here must not throw those away and reject an otherwise-legitimate sign-in.
		// Fail open on mustChangePassword (default false) rather than fail the whole request.
		let mustChangePassword = false;
		try {
			const user = await this.authentik.getUser(email);
			mustChangePassword = user.attributes?.[AUTHENTIK_MUST_CHANGE_PASSWORD_ATTR] === true;
		} catch (error) {
			console.error("SignInUseCase: could not look up mustChangePassword after sign-in", error);
		}

		return {
			accessToken: token.access_token,
			refreshToken: token.refresh_token,
			idToken: token.id_token,
			mustChangePassword,
		};
	}
}
