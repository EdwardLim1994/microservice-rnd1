import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import type EmployeeRepository from "../repositories/EmployeeRepository";
import type { RegisterEmployeeContext } from "./RegisterEmployeeSaga";

export default class CreateEmployeeUseCase extends BaseUseCase<
	RegisterEmployeeContext,
	Partial<RegisterEmployeeContext>
> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	async execute(context: RegisterEmployeeContext): Promise<Partial<RegisterEmployeeContext>> {
		const { firstName, lastName, gender, email, grossSalary, salaryPerDay, supervisorId } = context;

		if (!firstName || !lastName || !gender || !email) {
			throw new GraphQLError("firstName, lastName, gender, and email are required", {
				extensions: { code: "BAD_USER_INPUT" },
			});
		}

		if (supervisorId) {
			const supervisor = await this.employeeRepository.findById(supervisorId);
			if (!supervisor) {
				throw new GraphQLError(`supervisorId ${supervisorId} does not exist`, {
					extensions: { code: "NOT_FOUND" },
				});
			}
		}

		const existing = await this.employeeRepository.findByEmail(email);
		if (existing) {
			throw new GraphQLError(`An employee with email ${email} already exists`, {
				extensions: { code: "CONFLICT" },
			});
		}

		const employee = await this.employeeRepository.create({
			firstName,
			lastName,
			gender,
			email,
			grossSalary,
			salaryPerDay,
			supervisorId,
		});

		return { employeeId: employee.id, employee };
	}
}
