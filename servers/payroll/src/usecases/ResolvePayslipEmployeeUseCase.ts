import { BaseUseCase } from "server";

export default class ResolvePayslipEmployeeUseCase extends BaseUseCase<
	{ employeeId: string },
	{ __typename: "Employee"; id: string }
> {
	async execute({ employeeId }: { employeeId: string }) {
		return { __typename: "Employee" as const, id: employeeId };
	}
}
