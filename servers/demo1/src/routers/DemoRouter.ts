import { Demo1Demo1Proto } from "api";
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
		return `
			type Demo1 { id: ID! name: String! }
			type Query { demo1: Demo1 }
		`;
	}

	get handlers() {
		return { Query: { demo1: Demo1QueryUseCase } };
	}
}
