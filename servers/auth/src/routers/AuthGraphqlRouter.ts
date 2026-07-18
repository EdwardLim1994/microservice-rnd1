import { AuthGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import HealthUseCase from "../usecases/HealthUseCase";
import LoginUseCase from "../usecases/LoginUseCase";
import LogoutUseCase from "../usecases/LogoutUseCase";
import RegisterUseCase from "../usecases/RegisterUseCase";

export default class AuthGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return AuthGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: {
				health: HealthUseCase,
			},
			Mutation: {
				login: LoginUseCase,
				register: RegisterUseCase,
				logout: LogoutUseCase,
			},
		};
	}
}
