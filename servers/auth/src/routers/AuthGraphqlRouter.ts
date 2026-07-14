import { AuthGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import LoginUseCase from "../usecases/LoginUseCase";
import SignOutUseCase from "../usecases/SignOutUseCase";
import SignUpUseCase from "../usecases/SignUpUseCase";

export default class AuthGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return AuthGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Mutation: {
				login: LoginUseCase,
				signUp: SignUpUseCase,
				signOut: SignOutUseCase,
			},
		};
	}
}
