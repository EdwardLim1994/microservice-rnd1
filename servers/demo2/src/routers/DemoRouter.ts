import { Demo2Demo2Proto, Demo2Graphql } from "api";
import {
	GraphqlRouter,
	type GraphqlHandlerMap,
	type GrpcHandlerMap,
	GrpcRouter,
} from "lib";
import Demo2ByDemo1UseCase from "../usecases/Demo2ByDemo1UseCase";
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
		return Demo2Graphql.typeDefs;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: { demo2: Demo2QueryUseCase },
			Demo1: { demo2: Demo2ByDemo1UseCase },
		};
	}
}
