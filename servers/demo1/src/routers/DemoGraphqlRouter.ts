import { Demo1Graphql } from "api";
import { GraphqlRouter } from "lib";
import { Demo1QueryUseCase } from "../usecases";

export default class DemoGraphqlRouter extends GraphqlRouter {
	get typeDefs() {
		return Demo1Graphql.typeDefs;
	}

	get handlers() {
		return { Query: { demo1: Demo1QueryUseCase } };
	}
}
