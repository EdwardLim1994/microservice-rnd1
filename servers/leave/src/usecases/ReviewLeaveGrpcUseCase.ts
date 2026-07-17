import type { LeaveLeaveProto } from "api";
import { BaseUseCase } from "server";
import type ReviewLeaveUseCase from "./ReviewLeaveUseCase";
import toLeaveRequestMessage, {
	type LeaveRequestDomain,
} from "./toLeaveRequestMessage";

type ReviewLeaveRequest = LeaveLeaveProto.ReviewLeaveRequest;
type LeaveRequestMessage = LeaveLeaveProto.LeaveRequest;

export default class ReviewLeaveGrpcUseCase extends BaseUseCase<
	ReviewLeaveRequest,
	LeaveRequestMessage
> {
	private readonly reviewLeaveUseCase: ReviewLeaveUseCase;

	constructor({
		reviewLeaveUseCase,
	}: { reviewLeaveUseCase: ReviewLeaveUseCase }) {
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
		})) as LeaveRequestDomain;

		return toLeaveRequestMessage(leaveRequest);
	}
}
