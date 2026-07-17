import { BaseUseCase } from "server";
import EmployeeRepository from "../repositories/EmployeeRepository";

interface ListEmployeesInput {
	department?: string;
	role?: string;
}

export default class ListEmployeesUseCase extends BaseUseCase<ListEmployeesInput, unknown> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	execute(input: ListEmployeesInput) {
		return this.employeeRepository.findMany(input);
	}
}
