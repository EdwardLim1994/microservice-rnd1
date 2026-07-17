import { BaseUseCase } from "server";
import EmployeeRepository from "../repositories/EmployeeRepository";

export default class GetEmployeeUseCase extends BaseUseCase<{ id: string }, unknown> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	execute({ id }: { id: string }) {
		return this.employeeRepository.findById(id);
	}
}
