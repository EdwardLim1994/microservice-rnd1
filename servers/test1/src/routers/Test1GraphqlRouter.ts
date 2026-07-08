import { Test1Graphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import { GetTest1FromGrpcUseCase } from "../usecases";

export default class Test1GraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return Test1Graphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return { Query: { test1: GetTest1FromGrpcUseCase } };
	}
}
