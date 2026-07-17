import type { LeaveLeaveProto } from "api";
import { BaseUseCase } from "server";
import type SubmitLeaveUseCase from "./SubmitLeaveUseCase";
import toLeaveRequestMessage, {
	type LeaveRequestDomain,
} from "./toLeaveRequestMessage";

type SubmitLeaveRequest = LeaveLeaveProto.SubmitLeaveRequest;
type LeaveRequestMessage = LeaveLeaveProto.LeaveRequest;

/**
 * gRPC adapter over SubmitLeaveUseCase (FEAT-7 — leave-subgraph.LeaveService.SubmitLeave).
 * Reshapes proto's flat wire format (date strings, numeric enum) to/from the domain use case's
 * GraphQL-oriented shape — same pattern as employee-subgraph's RegisterEmployeeGrpcUseCase.
 */
export default class SubmitLeaveGrpcUseCase extends BaseUseCase<
	SubmitLeaveRequest,
	LeaveRequestMessage
> {
	private readonly submitLeaveUseCase: SubmitLeaveUseCase;

	constructor({
		submitLeaveUseCase,
	}: { submitLeaveUseCase: SubmitLeaveUseCase }) {
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
		})) as LeaveRequestDomain;

		return toLeaveRequestMessage(leaveRequest);
	}
}
