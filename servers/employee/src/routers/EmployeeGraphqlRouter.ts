import { EmployeeGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import ListEmployeesUseCase from "../usecases/ListEmployeesUseCase";
import RegisterEmployeeSaga from "../usecases/RegisterEmployeeSaga";
import ResolveEmployeeSupervisorUseCase from "../usecases/ResolveEmployeeSupervisorUseCase";

export default class EmployeeGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return EmployeeGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: {
				employees: ListEmployeesUseCase,
			},
			Mutation: {
				registerEmployee: RegisterEmployeeSaga,
			},
			Employee: {
				supervisor: ResolveEmployeeSupervisorUseCase,
			},
		};
	}
}
