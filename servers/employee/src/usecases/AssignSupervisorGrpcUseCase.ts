import type { EmployeeEmployeeProto } from "api";
import { BaseUseCase } from "server";
import toProtoEmployee from "../mappers/toProtoEmployee";
import type AssignSupervisorSaga from "./AssignSupervisorSaga";

type AssignSupervisorRequest = EmployeeEmployeeProto.AssignSupervisorRequest;
type AssignSupervisorResponse = EmployeeEmployeeProto.AssignSupervisorResponse;

// Thin gRPC adapter over AssignSupervisorSaga — same "decode/delegate/encode" shape as
// RegisterEmployeeGrpcUseCase, so gRPC and GraphQL never diverge in business logic.
export default class AssignSupervisorGrpcUseCase extends BaseUseCase<
	AssignSupervisorRequest,
	AssignSupervisorResponse
> {
	private readonly assignSupervisorSaga: AssignSupervisorSaga;

	constructor({ assignSupervisorSaga }: { assignSupervisorSaga: AssignSupervisorSaga }) {
		super();
		this.assignSupervisorSaga = assignSupervisorSaga;
	}

	async execute(request: AssignSupervisorRequest): Promise<AssignSupervisorResponse> {
		const result = await this.assignSupervisorSaga.execute({
			employeeId: request.employeeId,
			supervisorId: request.supervisorId,
		});

		const employee = result.employee;
		if (!employee) {
			throw new Error("AssignSupervisorSaga completed without producing an employee record");
		}

		return {
			$type: "employee.AssignSupervisorResponse",
			employee: toProtoEmployee(employee),
		};
	}
}
