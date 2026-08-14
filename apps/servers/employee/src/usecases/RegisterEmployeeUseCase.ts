import type {
	RegisterEmployeeRequest,
	RegisterEmployeeResponse,
} from "api/src/generated/employee/proto/employee";
import { BaseUseCase } from "server";
import type { EmployeeRepository } from "../repositories/EmployeeRepository";
import { generatePassword, toProto } from "./helpers";

export class RegisterEmployeeUseCase extends BaseUseCase<
	RegisterEmployeeRequest,
	RegisterEmployeeResponse
> {
	constructor(
		private readonly deps: { employeeRepository: EmployeeRepository },
	) {
		super();
	}

	async execute(
		req: RegisterEmployeeRequest,
	): Promise<RegisterEmployeeResponse> {
		const password = generatePassword();
		const row = await this.deps.employeeRepository.create({
			fullName: req.fullName,
			personalEmail: req.personalEmail,
			monthlyRate: req.monthlyRate,
			supervisorId: req.supervisorId,
		});
		return {
			$type: "employee.RegisterEmployeeResponse",
			employee: toProto(row),
			generatedPassword: password,
		};
	}
}
