import type { ServiceDefinition } from "@grpc/grpc-js";
import { Test2Test2Proto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import { GetTest2UseCase } from "../usecases";

export default class Test2GrpcRouter extends GrpcRouter<Test2Test2Proto.Test2ServiceServer> {
	get service(): ServiceDefinition<Test2Test2Proto.Test2ServiceServer> {
		return Test2Test2Proto.Test2ServiceService;
	}

	get handlers(): GrpcHandlerMap<Test2Test2Proto.Test2ServiceServer> {
		return {
			getTest2: GetTest2UseCase,
		};
	}
}
