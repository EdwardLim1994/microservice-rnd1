import { EmployeeEmployeeProto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import AssignSupervisorGrpcUseCase from "../usecases/AssignSupervisorGrpcUseCase";
import RegisterEmployeeGrpcUseCase from "../usecases/RegisterEmployeeGrpcUseCase";

export default class EmployeeGrpcRouter extends GrpcRouter<EmployeeEmployeeProto.EmployeeServiceServer> {
	get service() {
		return EmployeeEmployeeProto.EmployeeServiceService;
	}

	get handlers(): GrpcHandlerMap<EmployeeEmployeeProto.EmployeeServiceServer> {
		return {
			registerEmployee: RegisterEmployeeGrpcUseCase,
			assignSupervisor: AssignSupervisorGrpcUseCase,
		};
	}
}
