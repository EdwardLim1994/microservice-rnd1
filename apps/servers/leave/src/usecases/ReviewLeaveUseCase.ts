import type {
	ReviewLeaveRequest,
	ReviewLeaveResponse,
} from "api/src/generated/leave/proto/leave";
import type { KafkaProducer } from "server";
import { BaseUseCase } from "server";
import type { LeaveRepository } from "../repositories/LeaveRepository";
import { grpcInvalidArg, grpcNotFound, toProtoLeaveRequest } from "./helpers";

export class ReviewLeaveUseCase extends BaseUseCase<
	ReviewLeaveRequest,
	ReviewLeaveResponse
> {
	constructor(
		private readonly deps: {
			leaveRepository: LeaveRepository;
			kafkaProducer: KafkaProducer;
		},
	) {
		super();
	}

	async execute(req: ReviewLeaveRequest): Promise<ReviewLeaveResponse> {
		const existing = await this.deps.leaveRepository.findLeaveById(
			req.leaveRequestId,
		);
		if (!existing) throw grpcNotFound(req.leaveRequestId);
		if (existing.employeeId === req.reviewerId)
			throw grpcInvalidArg("Employee cannot approve their own leave request");
		if (existing.status !== "PENDING")
			throw grpcInvalidArg("Only PENDING requests can be reviewed");

		// proto numeric enum: 1=APPROVED, 2=REJECTED
		const decision = req.decision === 1 ? "APPROVED" : "REJECTED";
		const updated = await this.deps.leaveRepository.updateLeaveStatus(
			req.leaveRequestId,
			decision,
		);

		await this.deps.kafkaProducer.send("notification-events", {
			recipientId: existing.employeeId,
			type: "LEAVE_REQUEST_DECIDED",
			message: `Your leave request has been ${decision.toLowerCase()}.`,
		});

		return {
			$type: "leave.ReviewLeaveResponse",
			leaveRequest: toProtoLeaveRequest(updated),
		};
	}
}
