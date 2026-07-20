import { GraphQLError } from "graphql";
import type { AuthentikClient } from "server";
import { AuthentikApiError, BaseUseCase } from "server";
import type { RegisterEmployeeContext } from "./RegisterEmployeeSaga";

const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";

// ponytail: crypto.getRandomValues over a fixed charset — good enough entropy (16 chars from a
// 63-char alphabet, ~95 bits) for a one-time temporary password the employee must change on first
// login; swap for a dedicated password-generation library if policy requirements grow beyond that.
function generateTemporaryPassword(length = 16): string {
	const bytes = new Uint32Array(length);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join("");
}

export default class CreateAuthentikAccountUseCase extends BaseUseCase<
	RegisterEmployeeContext,
	Partial<RegisterEmployeeContext>
> {
	private readonly authentik: AuthentikClient;
	private readonly generatePassword: () => string;

	constructor(
		{ authentik }: { authentik: AuthentikClient },
		generatePassword: () => string = generateTemporaryPassword,
	) {
		super();
		this.authentik = authentik;
		this.generatePassword = generatePassword;
	}

	async execute({ firstName, lastName, email }: RegisterEmployeeContext): Promise<Partial<RegisterEmployeeContext>> {
		const temporaryPassword = this.generatePassword();

		try {
			await this.authentik.createUser({
				username: email,
				email,
				name: `${firstName} ${lastName}`,
				password: temporaryPassword,
				groupNames: ["employee"],
				attributes: { mustChangePassword: true },
			});
		} catch (error) {
			if (error instanceof AuthentikApiError) {
				throw new GraphQLError("Failed to create the employee's Authentik account", {
					extensions: { code: "AUTHENTIK_UNAVAILABLE" },
				});
			}
			throw error;
		}

		return { temporaryPassword };
	}
}
