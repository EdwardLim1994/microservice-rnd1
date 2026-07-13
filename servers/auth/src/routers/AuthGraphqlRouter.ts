import { AuthGraphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import RegisterUseCase from "../usecases/RegisterUseCase";
import SignInUseCase from "../usecases/SignInUseCase";
import SignOutUseCase from "../usecases/SignOutUseCase";

export default class AuthGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return AuthGraphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Mutation: {
				signIn: SignInUseCase,
				register: RegisterUseCase,
				signOut: SignOutUseCase,
			},
		};
	}
}
