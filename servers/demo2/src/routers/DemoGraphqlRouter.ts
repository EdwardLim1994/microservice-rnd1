import { Demo2Graphql } from "api";
import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import { Demo2ByDemo1UseCase, Demo2QueryUseCase } from "../usecases";

export default class DemoGraphqlRouter extends GraphqlRouter {
	get typeDefs() {
		return Demo2Graphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: { demo2: Demo2QueryUseCase },
			Demo1: { demo2: Demo2ByDemo1UseCase },
		};
	}
}
