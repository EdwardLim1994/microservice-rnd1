import { LeaveGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import ListLeaveRequestsUseCase from "../usecases/ListLeaveRequestsUseCase";
import ListPendingLeaveRequestsForSupervisorUseCase from "../usecases/ListPendingLeaveRequestsForSupervisorUseCase";
import ResolveLeaveRequestEmployeeUseCase from "../usecases/ResolveLeaveRequestEmployeeUseCase";
import ResolveLeaveRequestReferenceUseCase from "../usecases/ResolveLeaveRequestReferenceUseCase";
import ResolveLeaveRequestReviewedByUseCase from "../usecases/ResolveLeaveRequestReviewedByUseCase";
import ReviewLeaveUseCase from "../usecases/ReviewLeaveUseCase";
import SubmitLeaveUseCase from "../usecases/SubmitLeaveUseCase";

export default class LeaveGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return LeaveGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: {
				leaveRequests: ListLeaveRequestsUseCase,
				pendingLeaveRequestsForSupervisor:
					ListPendingLeaveRequestsForSupervisorUseCase,
			},
			Mutation: {
				submitLeave: SubmitLeaveUseCase,
				reviewLeave: ReviewLeaveUseCase,
			},
			LeaveRequest: {
				__resolveReference: ResolveLeaveRequestReferenceUseCase,
				employee: ResolveLeaveRequestEmployeeUseCase,
				reviewedBy: ResolveLeaveRequestReviewedByUseCase,
			},
		};
	}
}
