import { EmployeeEmployeeProto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import AssignSupervisorGrpcUseCase from "../usecases/AssignSupervisorGrpcUseCase";
import ConfirmPasswordResetGrpcUseCase from "../usecases/ConfirmPasswordResetGrpcUseCase";
import RegisterEmployeeGrpcUseCase from "../usecases/RegisterEmployeeGrpcUseCase";
import RequestPasswordResetGrpcUseCase from "../usecases/RequestPasswordResetGrpcUseCase";

export default class EmployeeGrpcRouter extends GrpcRouter<EmployeeEmployeeProto.EmployeeServiceServer> {
	get service() {
		return EmployeeEmployeeProto.EmployeeServiceService;
	}

	get handlers(): GrpcHandlerMap<EmployeeEmployeeProto.EmployeeServiceServer> {
		return {
			registerEmployee: RegisterEmployeeGrpcUseCase,
			assignSupervisor: AssignSupervisorGrpcUseCase,
			requestPasswordReset: RequestPasswordResetGrpcUseCase,
			confirmPasswordReset: ConfirmPasswordResetGrpcUseCase,
		};
	}
}
