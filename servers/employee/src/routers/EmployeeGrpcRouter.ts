import { EmployeeEmployeeProto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import ListEmployeesGrpcUseCase from "../usecases/ListEmployeesGrpcUseCase";
import RegisterEmployeeGrpcUseCase from "../usecases/RegisterEmployeeGrpcUseCase";

export default class EmployeeGrpcRouter extends GrpcRouter<EmployeeEmployeeProto.EmployeeServiceServer> {
	get service() {
		return EmployeeEmployeeProto.EmployeeServiceService;
	}

	get handlers(): GrpcHandlerMap<EmployeeEmployeeProto.EmployeeServiceServer> {
		return {
			registerEmployee: RegisterEmployeeGrpcUseCase,
			listEmployees: ListEmployeesGrpcUseCase,
		};
	}
}
