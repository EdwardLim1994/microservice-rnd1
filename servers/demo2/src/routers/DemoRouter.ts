import { Demo2Demo2Proto, Demo2Graphql } from "api";
import { parse } from "graphql";
import { GraphqlRouter, GrpcRouter } from "lib/router";
import { demo2, testDemo } from "../usecases";

export class DemoGrpcRouter extends GrpcRouter<Demo2Demo2Proto.DemoServiceServer> {
	constructor() {
		super(Demo2Demo2Proto.DemoServiceService);
	}

	public implementation(): Demo2Demo2Proto.DemoServiceServer {
		return {
			testDemo,
		};
	}
}

export class DemoGraphqlRouter extends GraphqlRouter<Demo2Graphql.Demo2ContextType> {
	constructor() {
		super(parse(Demo2Graphql.typeDefs));
	}

	protected prepareResolvers(): Demo2Graphql.Resolvers {
		return {
			Query: {
				demo2: () => demo2(),
			},
			Demo1: {
				__resolveReference: (ref: { id: string }) => ref,
				demo2: () => demo2().then((d) => [d]),
			},
		};
	}
}
