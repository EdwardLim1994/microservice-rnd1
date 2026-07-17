import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import EmployeeRepository from "../repositories/EmployeeRepository";

interface AssignSupervisorInput {
	employeeId: string;
	supervisorId: string;
}

export default class AssignSupervisorUseCase extends BaseUseCase<
	{ input: AssignSupervisorInput },
	unknown
> {
	private readonly employeeRepository: EmployeeRepository;

	constructor({ employeeRepository }: { employeeRepository: EmployeeRepository }) {
		super();
		this.employeeRepository = employeeRepository;
	}

	// See RegisterEmployeeUseCase's comment — GraphQL's wrapped `input:` argument arrives as
	// `{ input: {...} }`, not the flat fields.
	async execute({ input: { employeeId, supervisorId } }: { input: AssignSupervisorInput }) {
		if (employeeId === supervisorId) {
			throw new GraphQLError("An employee cannot be assigned as their own supervisor", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}

		const employee = await this.employeeRepository.findById(employeeId);
		if (!employee) {
			throw new GraphQLError("employeeId does not exist", { extensions: { code: "NOT_FOUND" } });
		}

		const supervisor = await this.employeeRepository.findById(supervisorId);
		if (!supervisor) {
			throw new GraphQLError("supervisorId does not exist", { extensions: { code: "NOT_FOUND" } });
		}

		return this.employeeRepository.updateSupervisor(employeeId, supervisorId);
	}
}
