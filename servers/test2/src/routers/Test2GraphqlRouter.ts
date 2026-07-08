import { Test2Graphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import { GetTest2ForTest1UseCase, GetTest2FromGrpcUseCase } from "../usecases";

export default class Test2GraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return Test2Graphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: { test2: GetTest2FromGrpcUseCase },
			Test1: { test2: GetTest2ForTest1UseCase },
		};
	}
}
