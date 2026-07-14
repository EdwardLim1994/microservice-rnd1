import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient, BaseUseCase } from "server";

interface RegisterInput {
	email: string;
	password: string;
}

interface RegisterPayload {
	success: boolean;
	message: string;
}

// Each domain label excludes '.' so the two `+` groups either side of it can't both match the
// same characters — removes the backtracking ambiguity `[^\s@]+@[^\s@]+\.[^\s@]+` had.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

// Authentik uses the submitted email as the username (see AuthentikClient.enroll()), so a
// duplicate-email registration surfaces as a username-uniqueness violation — check both fields,
// and both the flat DRF-style shape (createUser's own create-time errors) and the nested
// response_errors shape (Flow Executor-style challenges, in case a future enrollment flow is
// layered underneath enroll() without this use case needing to change).
function looksLikeDuplicateEmail(body: unknown): boolean {
	if (typeof body !== "object" || body === null) return false;
	const b = body as Record<string, unknown>;
	const nested = (b.response_errors ?? {}) as Record<string, unknown>;
	const candidates = [b.username, b.email, nested.username, nested.email];
	return candidates.some(
		(errors) => Array.isArray(errors) && errors.length > 0,
	);
}

function extractPasswordPolicyMessage(body: unknown): string | undefined {
	if (typeof body !== "object" || body === null) return undefined;
	const b = body as Record<string, unknown>;
	const nested = (b.response_errors ?? {}) as Record<string, unknown>;
	const errors = (
		Array.isArray(b.password) ? b.password : nested.password
	) as unknown;
	if (!Array.isArray(errors) || errors.length === 0) return undefined;
	const first = errors[0];
	if (typeof first === "string") return first;
	if (typeof first === "object" && first !== null && "string" in first) {
		return String((first as Record<string, unknown>).string);
	}
	return undefined;
}

export default class RegisterUseCase extends BaseUseCase<
	RegisterInput,
	RegisterPayload
> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ email, password }: RegisterInput): Promise<RegisterPayload> {
		const trimmedEmail = email.trim();
		const trimmedPassword = password.trim();

		if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
			throw new GraphQLError("A valid email address is required", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}
		if (!trimmedPassword) {
			throw new GraphQLError("Password is required", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}

		try {
			await this.authentik.enroll(trimmedEmail, trimmedPassword);
			return { success: true, message: "Registration successful." };
		} catch (error) {
			if (error instanceof AuthentikApiError && error.status === 400) {
				if (looksLikeDuplicateEmail(error.body)) {
					throw new GraphQLError("An account with that email already exists", {
						extensions: { code: "DUPLICATE_EMAIL" },
					});
				}
				const policyMessage = extractPasswordPolicyMessage(error.body);
				if (policyMessage) {
					throw new GraphQLError(policyMessage, {
						extensions: { code: "PASSWORD_POLICY_VIOLATION" },
					});
				}
				throw new GraphQLError("Invalid registration details", {
					extensions: { code: "VALIDATION_ERROR" },
				});
			}
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}
	}
}
