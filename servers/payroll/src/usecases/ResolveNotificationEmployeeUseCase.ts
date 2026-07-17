import { BaseUseCase } from "server";

export default class ResolveNotificationEmployeeUseCase extends BaseUseCase<
	{ employeeId: string },
	{ __typename: "Employee"; id: string }
> {
	async execute({ employeeId }: { employeeId: string }) {
		return { __typename: "Employee" as const, id: employeeId };
	}
}
