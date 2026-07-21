import { BaseUseCase } from "server";
import type { Employee } from "../../generated/prisma";
import type AssignSupervisorSaga from "./AssignSupervisorSaga";
import type { AssignSupervisorContext } from "./AssignSupervisorSaga";

// Thin GraphQL adapter over AssignSupervisorSaga — Mutation.assignSupervisor returns the updated
// Employee record directly (not wrapped in a result type, per the contract already fixed by
// e2e/api/hr-admin-employee-registration/assign-supervisor.test.ts), so this unwraps the saga's
// accumulated context down to just its `employee` field.
export default class AssignSupervisorGraphqlUseCase extends BaseUseCase<
	{ employeeId: string; supervisorId: string },
	Employee
> {
	private readonly assignSupervisorSaga: AssignSupervisorSaga;

	constructor({ assignSupervisorSaga }: { assignSupervisorSaga: AssignSupervisorSaga }) {
		super();
		this.assignSupervisorSaga = assignSupervisorSaga;
	}

	async execute(args: { employeeId: string; supervisorId: string }): Promise<Employee> {
		const result: AssignSupervisorContext = await this.assignSupervisorSaga.execute(args);
		if (!result.employee) {
			throw new Error("AssignSupervisorSaga completed without producing an employee record");
		}
		return result.employee;
	}
}
