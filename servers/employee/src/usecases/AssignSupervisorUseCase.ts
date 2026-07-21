import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import type EmployeeRepository from "../repositories/EmployeeRepository";
import type { AssignSupervisorContext } from "./AssignSupervisorSaga";

const MINIMUM_TENURE_YEARS = 5;

export default class AssignSupervisorUseCase extends BaseUseCase<
	AssignSupervisorContext,
	Partial<AssignSupervisorContext>
> {
	private readonly employeeRepository: EmployeeRepository;
	private readonly now: () => Date;

	constructor(
		{ employeeRepository }: { employeeRepository: EmployeeRepository },
		now: () => Date = () => new Date(),
	) {
		super();
		this.employeeRepository = employeeRepository;
		this.now = now;
	}

	async execute({ employeeId, supervisorId }: AssignSupervisorContext): Promise<Partial<AssignSupervisorContext>> {
		if (employeeId === supervisorId) {
			throw new GraphQLError("employeeId and supervisorId must not be the same", {
				extensions: { code: "BAD_USER_INPUT" },
			});
		}

		const employee = await this.employeeRepository.findById(employeeId);
		if (!employee) {
			throw new GraphQLError(`Employee ${employeeId} not found`, {
				extensions: { code: "NOT_FOUND" },
			});
		}

		const supervisor = await this.employeeRepository.findById(supervisorId);
		if (!supervisor) {
			throw new GraphQLError(`Employee ${supervisorId} not found`, {
				extensions: { code: "NOT_FOUND" },
			});
		}

		const minimumTenureCutoff = new Date(this.now());
		minimumTenureCutoff.setFullYear(minimumTenureCutoff.getFullYear() - MINIMUM_TENURE_YEARS);
		if (supervisor.createdAt > minimumTenureCutoff) {
			throw new GraphQLError(
				`Employee ${supervisorId} has served fewer than ${MINIMUM_TENURE_YEARS} years and is not eligible to supervise`,
				{ extensions: { code: "INELIGIBLE" } },
			);
		}

		const updated = await this.employeeRepository.updateSupervisor(employeeId, supervisorId);

		return { previousSupervisorId: employee.supervisorId, employee: updated };
	}
}
