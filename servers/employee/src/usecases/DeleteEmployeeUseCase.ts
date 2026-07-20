import { BaseUseCase } from "server";
import type EmployeeRepository from "../repositories/EmployeeRepository";
import type { RegisterEmployeeContext } from "./RegisterEmployeeSaga";

// Compensation for CreateEmployeeUseCase — runs if a later procedure (CreateAuthentikAccountUseCase)
// fails, so a saved Employee row never outlives a failed Authentik account creation.
export default class DeleteEmployeeUseCase extends BaseUseCase<RegisterEmployeeContext, void> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	async execute({ employeeId }: RegisterEmployeeContext): Promise<void> {
		if (employeeId) {
			await this.employeeRepository.delete(employeeId);
		}
	}
}
