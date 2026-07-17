import { LeaveLeaveProto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import ReviewLeaveGrpcUseCase from "../usecases/ReviewLeaveGrpcUseCase";
import SubmitLeaveGrpcUseCase from "../usecases/SubmitLeaveGrpcUseCase";

export default class LeaveGrpcRouter extends GrpcRouter<LeaveLeaveProto.LeaveServiceServer> {
	get service() {
		return LeaveLeaveProto.LeaveServiceService;
	}

	get handlers(): GrpcHandlerMap<LeaveLeaveProto.LeaveServiceServer> {
		return {
			submitLeave: SubmitLeaveGrpcUseCase,
			reviewLeave: ReviewLeaveGrpcUseCase,
		};
	}
}
