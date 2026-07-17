import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import AssignSupervisorUseCase from "./AssignSupervisorUseCase";

type AssignSupervisorRequest = EmployeeEmployeeProto.AssignSupervisorRequest;
type Employee = EmployeeEmployeeProto.Employee;

/** gRPC adapter over AssignSupervisorUseCase — see RegisterEmployeeGrpcUseCase's comment. */
export default class AssignSupervisorGrpcUseCase extends BaseUseCase<AssignSupervisorRequest, Employee> {
	private readonly assignSupervisorUseCase: AssignSupervisorUseCase;

	constructor({ assignSupervisorUseCase }: { assignSupervisorUseCase: AssignSupervisorUseCase }) {
		super();
		this.assignSupervisorUseCase = assignSupervisorUseCase;
	}

	async execute(request: AssignSupervisorRequest): Promise<Employee> {
		const result = (await this.assignSupervisorUseCase.execute({
			input: { employeeId: request.employeeId, supervisorId: request.supervisorId },
		})) as {
			id: string;
			employeeId: string;
			fullName: string;
			role: string;
			department: string;
			grossSalary: number;
			supervisor: { id: string } | null;
			createdAt: Date;
		};

		return {
			$type: "employee.Employee",
			id: result.id,
			employeeId: result.employeeId,
			fullName: result.fullName,
			role: result.role,
			department: result.department,
			grossSalary: result.grossSalary,
			supervisorId: result.supervisor?.id ?? "",
			createdAt: result.createdAt.toISOString(),
		};
	}
}
