import type { LeaveLeaveProto } from "api";

export interface LeaveRequestDomain {
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
}

/** Shared domain -> proto mapping used by both SubmitLeaveGrpcUseCase and ReviewLeaveGrpcUseCase. */
export default function toLeaveRequestMessage(
	leaveRequest: LeaveRequestDomain,
): LeaveLeaveProto.LeaveRequest {
	return {
		$type: "leave.LeaveRequest",
		id: leaveRequest.id,
		employeeId: leaveRequest.employeeId,
		leaveType:
			leaveRequest.leaveType as LeaveLeaveProto.LeaveRequest["leaveType"],
		startDate: leaveRequest.startDate.toISOString().slice(0, 10),
		endDate: leaveRequest.endDate.toISOString().slice(0, 10),
		reason: leaveRequest.reason,
		status: leaveRequest.status as LeaveLeaveProto.LeaveRequest["status"],
		submittedAt: leaveRequest.submittedAt.toISOString(),
		reviewedById: leaveRequest.reviewedById ?? "",
		reviewedAt: leaveRequest.reviewedAt?.toISOString() ?? "",
	};
}
