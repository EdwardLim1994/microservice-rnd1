import { GraphQLError } from "graphql";
import { AuthentikApiError, type AuthentikClient, BaseUseCase } from "server";

interface RegisterInput {
	email: string;
	password: string;
}

interface RegisterResultPayload {
	success: boolean;
	message: string;
}

interface EnrollmentChallenge {
	component?: string;
	response_errors?: Record<string, { string?: string }[]>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Authentik's response_errors is keyed per-field for format failures (e.g. { username: [...] })
// but per-form for the bound password policy (non_field_errors) — this flow's prompt stage only
// has two fields, so the first error found under either key is unambiguous.
function extractPromptError(challenge: EnrollmentChallenge): string | undefined {
	for (const errors of Object.values(challenge.response_errors ?? {})) {
		const first = errors[0]?.string;
		if (first) return first;
	}
	return undefined;
}

export default class RegisterUseCase extends BaseUseCase<RegisterInput, RegisterResultPayload> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ email, password }: RegisterInput): Promise<RegisterResultPayload> {
		if (!email.trim() || !password || !EMAIL_PATTERN.test(email)) {
			throw new GraphQLError("A valid email and non-empty password are required", {
				extensions: { code: "BAD_USER_INPUT" },
			});
		}

		try {
			await this.authentik.enroll(email, password);
			return { success: true, message: "Account created successfully" };
		} catch (error) {
			if (error instanceof AuthentikApiError) {
				const challenge = error.body as EnrollmentChallenge;
				if (challenge?.component === "ak-stage-access-denied") {
					throw new GraphQLError("An account with this email already exists", {
						extensions: { code: "DUPLICATE_EMAIL" },
					});
				}
				const policyMessage = extractPromptError(challenge ?? {});
				if (policyMessage) {
					throw new GraphQLError(policyMessage, { extensions: { code: "PASSWORD_POLICY" } });
				}
			}
			throw new GraphQLError("Authentication service is unavailable", {
				extensions: { code: "AUTHENTIK_UNAVAILABLE" },
			});
		}
	}
}
