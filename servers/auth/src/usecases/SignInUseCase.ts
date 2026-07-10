import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient, BaseUseCase } from "server";

interface SignInInput {
	username: string;
	password: string;
}

interface AuthTokensPayload {
	accessToken: string;
	refreshToken?: string;
	idToken?: string;
	tokenType: string;
	expiresIn: number;
}

export default class SignInUseCase extends BaseUseCase<SignInInput, AuthTokensPayload> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ username, password }: SignInInput): Promise<AuthTokensPayload> {
		try {
			const token = await this.authentik.signIn(username, password);
			return {
				accessToken: token.access_token,
				refreshToken: token.refresh_token,
				idToken: token.id_token,
				tokenType: token.token_type,
				expiresIn: token.expires_in,
			};
		} catch (error) {
			if (error instanceof AuthentikApiError && (error.status === 400 || error.status === 401)) {
				// Never echo Authentik's raw error body back to the client — it can leak IdP
				// internals (e.g. which of username/password was wrong).
				throw new GraphQLError("Invalid username or password", {
					extensions: { code: "INVALID_CREDENTIALS" },
				});
			}
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}
	}
}
