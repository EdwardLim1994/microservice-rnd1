import { Demo2Demo2Proto } from "api";
import { type GrpcHandlerMap, GrpcRouter, GraphqlRouter } from "lib";
import Demo2QueryUseCase from "../usecases/Demo2QueryUseCase";
import TestDemoUseCase from "../usecases/TestDemoUseCase";

export class DemoGrpcRouter extends GrpcRouter<Demo2Demo2Proto.DemoServiceServer> {
	get service() {
		return Demo2Demo2Proto.DemoServiceService;
	}

	get handlers(): GrpcHandlerMap<Demo2Demo2Proto.DemoServiceServer> {
		return { testDemo: TestDemoUseCase };
	}
}

export class DemoGraphqlRouter extends GraphqlRouter {
	get typeDefs() {
		return `
			type Demo2 { id: ID! name: String! }
			type Query { demo2: Demo2 }
		`;
	}

	get handlers() {
		return { Query: { demo2: Demo2QueryUseCase } };
	}
}
