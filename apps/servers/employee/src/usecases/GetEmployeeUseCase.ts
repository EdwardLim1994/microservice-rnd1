import type {
	Employee,
	GetEmployeeRequest,
} from "api/src/generated/employee/proto/employee";
import { BaseUseCase } from "server";
import type { EmployeeRepository } from "../repositories/EmployeeRepository";
import { grpcNotFound, toProto } from "./helpers";

export class GetEmployeeUseCase extends BaseUseCase<
	GetEmployeeRequest,
	Employee
> {
	constructor(
		private readonly deps: { employeeRepository: EmployeeRepository },
	) {
		super();
	}

	async execute(req: GetEmployeeRequest): Promise<Employee> {
		const row = await this.deps.employeeRepository.findById(req.id);
		if (!row) throw grpcNotFound(req.id);
		return toProto(row);
	}
}
