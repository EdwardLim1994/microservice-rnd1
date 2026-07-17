import { EmployeeGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import AssignSupervisorUseCase from "../usecases/AssignSupervisorUseCase";
import GetEmployeeUseCase from "../usecases/GetEmployeeUseCase";
import ListEmployeesUseCase from "../usecases/ListEmployeesUseCase";
import RegisterEmployeeUseCase from "../usecases/RegisterEmployeeUseCase";
import ResolveEmployeeReferenceUseCase from "../usecases/ResolveEmployeeReferenceUseCase";

export default class EmployeeGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return EmployeeGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: {
				employee: GetEmployeeUseCase,
				employees: ListEmployeesUseCase,
			},
			Mutation: {
				registerEmployee: RegisterEmployeeUseCase,
				assignSupervisor: AssignSupervisorUseCase,
			},
			Employee: {
				__resolveReference: ResolveEmployeeReferenceUseCase,
			},
		};
	}
}
