import { type AuthentikClient, BaseUseCase } from "server";

interface SignOutInput {
	refreshToken: string;
}

export default class SignOutUseCase extends BaseUseCase<SignOutInput, boolean> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ refreshToken }: SignOutInput): Promise<boolean> {
		await this.authentik.revokeToken(refreshToken, "refresh_token");
		return true;
	}
}
