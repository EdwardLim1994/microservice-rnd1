import { BaseUseCase } from "server";
import type EmployeeRepository from "../repositories/EmployeeRepository";
import type { AssignSupervisorContext } from "./AssignSupervisorSaga";

// Compensation for AssignSupervisorUseCase — runs if a later procedure (UpdateAuthentikGroupUseCase)
// fails, so a persisted supervisorId change never outlives a failed Authentik group update.
export default class RevertEmployeeSupervisorUseCase extends BaseUseCase<AssignSupervisorContext, void> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	async execute({ employeeId, previousSupervisorId }: AssignSupervisorContext): Promise<void> {
		await this.employeeRepository.updateSupervisor(employeeId, previousSupervisorId ?? null);
	}
}
