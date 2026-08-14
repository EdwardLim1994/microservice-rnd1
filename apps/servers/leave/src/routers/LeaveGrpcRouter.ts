import type { LeaveServiceServer } from "api/src/generated/leave/proto/leave";
import { LeaveServiceService } from "api/src/generated/leave/proto/leave";
import { GrpcRouter } from "server";
import { GetLeaveBalanceUseCase } from "../usecases/GetLeaveBalanceUseCase";
import { GetUnpaidLeaveDaysUseCase } from "../usecases/GetUnpaidLeaveDaysUseCase";
import { ListLeaveRequestsUseCase } from "../usecases/ListLeaveRequestsUseCase";
import { ReviewLeaveUseCase } from "../usecases/ReviewLeaveUseCase";
import { SubmitLeaveUseCase } from "../usecases/SubmitLeaveUseCase";

export class LeaveGrpcRouter extends GrpcRouter<LeaveServiceServer> {
	get service() {
		return LeaveServiceService;
	}

	get handlers() {
		return {
			submitLeave: SubmitLeaveUseCase,
			reviewLeave: ReviewLeaveUseCase,
			getLeaveBalance: GetLeaveBalanceUseCase,
			listLeaveRequests: ListLeaveRequestsUseCase,
			getUnpaidLeaveDays: GetUnpaidLeaveDaysUseCase,
		};
	}
}
