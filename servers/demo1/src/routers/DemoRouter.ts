import { Demo1Demo1Proto, Demo1Graphql } from "api";
import { parse } from "graphql";
import { GraphqlRouter, GrpcRouter } from "lib/router";
import { demo1, testDemo } from "../usecases";

export class DemoGrpcRouter extends GrpcRouter<Demo1Demo1Proto.DemoServiceServer> {
	constructor() {
		super(Demo1Demo1Proto.DemoServiceService);
	}

	public implementation(): Demo1Demo1Proto.DemoServiceServer {
		return {
			testDemo,
		};
	}
}

export class DemoGraphqlRouter extends GraphqlRouter<Demo1Graphql.Demo1ContextType> {
	constructor() {
		super(parse(Demo1Graphql.typeDefs));
	}

	protected prepareResolvers(): Demo1Graphql.Resolvers {
		return {
			Query: {
				demo1: () => demo1(),
			},
		};
	}
}
