import { BaseUseCase } from "server";
import type EmployeeRepository from "../repositories/EmployeeRepository";

export default class ListEmployeesUseCase extends BaseUseCase<
	void,
	ReturnType<EmployeeRepository["findAll"]>
> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	execute() {
		return this.employeeRepository.findAll();
	}
}
