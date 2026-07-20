import { EmployeeGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import RegisterEmployeeSaga from "../usecases/RegisterEmployeeSaga";

export default class EmployeeGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return EmployeeGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Mutation: {
				registerEmployee: RegisterEmployeeSaga,
			},
		};
	}
}
