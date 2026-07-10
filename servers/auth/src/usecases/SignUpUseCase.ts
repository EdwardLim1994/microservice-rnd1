import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient, BaseUseCase } from "server";

interface SignUpUseCaseInput {
	input: {
		username: string;
		email: string;
		password: string;
		name?: string;
	};
}

interface SignUpResultPayload {
	id: string;
	username: string;
	email: string;
}

// DRF field-errors dict — confirmed live against Authentik 2026.5.4:
// { "username": ["This field must be unique."] }. "username" is the only field this create call
// sends that has a uniqueness constraint, so any non-empty error array on that field is reliably
// a duplicate-username rejection, not some other validation failure.
function looksLikeDuplicateUsername(body: unknown): boolean {
	if (typeof body !== "object" || body === null) return false;
	const usernameErrors = (body as Record<string, unknown>).username;
	return Array.isArray(usernameErrors) && usernameErrors.length > 0;
}

export default class SignUpUseCase extends BaseUseCase<SignUpUseCaseInput, SignUpResultPayload> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ input }: SignUpUseCaseInput): Promise<SignUpResultPayload> {
		try {
			const user = await this.authentik.createUser(input);
			return { id: String(user.pk), username: user.username, email: user.email };
		} catch (error) {
			if (error instanceof AuthentikApiError && error.status === 400) {
				if (looksLikeDuplicateUsername(error.body)) {
					throw new GraphQLError("Username is already taken", {
						extensions: { code: "USERNAME_TAKEN" },
					});
				}
				throw new GraphQLError("Invalid sign-up details", {
					extensions: { code: "VALIDATION_ERROR" },
				});
			}
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}
	}
}
