import { BaseUseCase } from "server";
import type EmployeeRepository from "../repositories/EmployeeRepository";

interface EmployeeParent {
	supervisorId?: string | null;
}

// Field resolver for Employee.supervisor — parent is the Employee GraphQL is currently
// resolving, per GraphqlRouter's "entity-type fields receive parent, not args" convention.
export default class ResolveEmployeeSupervisorUseCase extends BaseUseCase<
	EmployeeParent,
	ReturnType<EmployeeRepository["findById"]> | null
> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	execute({ supervisorId }: EmployeeParent) {
		if (!supervisorId) return null;
		return this.employeeRepository.findById(supervisorId);
	}
}
