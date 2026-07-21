import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import toProtoEmployee from "../mappers/toProtoEmployee";
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
			employees: employees.map(toProtoEmployee),
		};
	}
}
