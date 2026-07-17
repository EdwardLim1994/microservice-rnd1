import type { LeaveLeaveProto } from "api";
import { BaseUseCase } from "server";
import SubmitLeaveUseCase from "./SubmitLeaveUseCase";

type SubmitLeaveRequest = LeaveLeaveProto.SubmitLeaveRequest;
type LeaveRequestMessage = LeaveLeaveProto.LeaveRequest;

/**
 * gRPC adapter over SubmitLeaveUseCase (FEAT-7 — leave-subgraph.LeaveService.SubmitLeave).
 * Reshapes proto's flat wire format (date strings, numeric enum) to/from the domain use case's
 * GraphQL-oriented shape — same pattern as employee-subgraph's RegisterEmployeeGrpcUseCase.
 */
export default class SubmitLeaveGrpcUseCase extends BaseUseCase<SubmitLeaveRequest, LeaveRequestMessage> {
	private readonly submitLeaveUseCase: SubmitLeaveUseCase;

	constructor({ submitLeaveUseCase }: { submitLeaveUseCase: SubmitLeaveUseCase }) {
		super();
		this.submitLeaveUseCase = submitLeaveUseCase;
	}

	async execute(request: SubmitLeaveRequest): Promise<LeaveRequestMessage> {
		const leaveRequest = (await this.submitLeaveUseCase.execute({
			input: {
				employeeId: request.employeeId,
				leaveType: request.leaveType as "ANNUAL" | "MEDICAL" | "EMERGENCY",
				startDate: request.startDate,
				endDate: request.endDate,
				reason: request.reason,
			},
		})) as {
			id: string;
			employeeId: string;
			leaveType: string;
			startDate: Date;
			endDate: Date;
			reason: string;
			status: string;
			submittedAt: Date;
			reviewedById: string | null;
			reviewedAt: Date | null;
		};

		return {
			$type: "leave.LeaveRequest",
			id: leaveRequest.id,
			employeeId: leaveRequest.employeeId,
			leaveType: leaveRequest.leaveType as LeaveRequestMessage["leaveType"],
			startDate: leaveRequest.startDate.toISOString().slice(0, 10),
			endDate: leaveRequest.endDate.toISOString().slice(0, 10),
			reason: leaveRequest.reason,
			status: leaveRequest.status as LeaveRequestMessage["status"],
			submittedAt: leaveRequest.submittedAt.toISOString(),
			reviewedById: leaveRequest.reviewedById ?? "",
			reviewedAt: leaveRequest.reviewedAt?.toISOString() ?? "",
		};
	}
}
