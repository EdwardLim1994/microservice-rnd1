import { ProcedureOrchestrator } from "server";
import type { Employee } from "../../generated/prisma";
import AssignSupervisorUseCase from "./AssignSupervisorUseCase";
import NoopUseCase from "./NoopUseCase";
import RevertEmployeeSupervisorUseCase from "./RevertEmployeeSupervisorUseCase";
import UpdateAuthentikGroupUseCase from "./UpdateAuthentikGroupUseCase";

export interface AssignSupervisorContext {
	employeeId: string;
	supervisorId: string;
	previousSupervisorId?: string | null;
	/** The employeeId record, post-update — this is what the gRPC/GraphQL response returns. */
	employee?: Employee;
	/** The supervisorId record — whose Authentik account gets promoted to the "supervisor" group. */
	supervisor?: Employee;
}

// FEAT-3: Assign supervisor to employee — persists Employee.supervisorId, then moves the target's
// Authentik account into the "supervisor" group. If the Authentik call fails, the supervisorId
// change is reverted (saga compensation), same shape as FEAT-1's RegisterEmployeeSaga.
export default class AssignSupervisorSaga extends ProcedureOrchestrator<AssignSupervisorContext> {
	protected build() {
		this.procedure(AssignSupervisorUseCase, RevertEmployeeSupervisorUseCase).procedure(
			UpdateAuthentikGroupUseCase,
			NoopUseCase,
		);
	}
}
