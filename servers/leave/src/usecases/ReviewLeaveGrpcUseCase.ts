import type { LeaveLeaveProto } from "api";
import { BaseUseCase } from "server";
import ReviewLeaveUseCase from "./ReviewLeaveUseCase";

type ReviewLeaveRequest = LeaveLeaveProto.ReviewLeaveRequest;
type LeaveRequestMessage = LeaveLeaveProto.LeaveRequest;

export default class ReviewLeaveGrpcUseCase extends BaseUseCase<ReviewLeaveRequest, LeaveRequestMessage> {
	private readonly reviewLeaveUseCase: ReviewLeaveUseCase;

	constructor({ reviewLeaveUseCase }: { reviewLeaveUseCase: ReviewLeaveUseCase }) {
		super();
		this.reviewLeaveUseCase = reviewLeaveUseCase;
	}

	async execute(request: ReviewLeaveRequest): Promise<LeaveRequestMessage> {
		const leaveRequest = (await this.reviewLeaveUseCase.execute({
			input: {
				leaveRequestId: request.leaveRequestId,
				supervisorId: request.supervisorId,
				decision: request.decision as "APPROVED" | "REJECTED",
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
