import { GraphQLError } from "graphql";
import type { AuthentikClient } from "server";
import { AuthentikApiError, BaseUseCase } from "server";
import type { AssignSupervisorContext } from "./AssignSupervisorSaga";

export default class UpdateAuthentikGroupUseCase extends BaseUseCase<
	AssignSupervisorContext,
	Partial<AssignSupervisorContext>
> {
	private readonly authentik: AuthentikClient;

	constructor({ authentik }: { authentik: AuthentikClient }) {
		super();
		this.authentik = authentik;
	}

	async execute({ employee }: AssignSupervisorContext): Promise<Partial<AssignSupervisorContext>> {
		if (!employee) {
			throw new Error("UpdateAuthentikGroupUseCase requires the updated employee record");
		}

		try {
			await this.authentik.updateUserGroups(employee.email, ["supervisor"]);
		} catch (error) {
			if (error instanceof AuthentikApiError) {
				throw new GraphQLError("Failed to update the employee's Authentik account group", {
					extensions: { code: "AUTHENTIK_UNAVAILABLE" },
				});
			}
			throw error;
		}

		return {};
	}
}
