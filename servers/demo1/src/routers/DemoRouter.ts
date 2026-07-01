import { Demo1Demo1Proto, Demo1Graphql } from "api";
import { GraphqlRouter, type GrpcHandlerMap, GrpcRouter } from "lib";
import Demo1QueryUseCase from "../usecases/Demo1QueryUseCase";
import TestDemoUseCase from "../usecases/TestDemoUseCase";

export class DemoGrpcRouter extends GrpcRouter<Demo1Demo1Proto.DemoServiceServer> {
	get service() {
		return Demo1Demo1Proto.DemoServiceService;
	}

	get handlers(): GrpcHandlerMap<Demo1Demo1Proto.DemoServiceServer> {
		return { testDemo: TestDemoUseCase };
	}
}

export class DemoGraphqlRouter extends GraphqlRouter {
	get typeDefs() {
		return Demo1Graphql.typeDefs;
	}

	get handlers() {
		return { Query: { demo1: Demo1QueryUseCase } };
	}
}
