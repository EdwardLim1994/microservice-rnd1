import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import type EmployeeRepository from "../repositories/EmployeeRepository";

type ListEmployeesRequest = EmployeeEmployeeProto.ListEmployeesRequest;
type ListEmployeesResponse = EmployeeEmployeeProto.ListEmployeesResponse;

export default class ListEmployeesGrpcUseCase extends BaseUseCase<
	ListEmployeesRequest,
	ListEmployeesResponse
> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	async execute(): Promise<ListEmployeesResponse> {
		const employees = await this.employeeRepository.findAll();

		return {
			$type: "employee.ListEmployeesResponse",
			employees: employees.map((employee) => ({
				$type: "employee.Employee",
				id: employee.id,
				firstName: employee.firstName,
				lastName: employee.lastName,
				gender: employee.gender,
				email: employee.email,
				grossSalary: employee.grossSalary,
				salaryPerDay: employee.salaryPerDay,
				supervisorId: employee.supervisorId ?? undefined,
				createdAt: employee.createdAt.toISOString(),
				updatedAt: employee.updatedAt.toISOString(),
			})),
		};
	}
}
