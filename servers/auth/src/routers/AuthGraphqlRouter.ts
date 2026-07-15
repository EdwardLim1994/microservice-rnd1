import { AuthGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
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
				health: () => true,
			},
			Mutation: {
				login: LoginUseCase,
				register: RegisterUseCase,
				logout: LogoutUseCase,
			},
		};
	}
}
