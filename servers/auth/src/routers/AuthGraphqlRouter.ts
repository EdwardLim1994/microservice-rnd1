import { AuthGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import LoginUseCase from "../usecases/LoginUseCase";
import RegisterUseCase from "../usecases/RegisterUseCase";
import SignOutUseCase from "../usecases/SignOutUseCase";

export default class AuthGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return AuthGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Mutation: {
				login: LoginUseCase,
				register: RegisterUseCase,
				signOut: SignOutUseCase,
			},
		};
	}
}
