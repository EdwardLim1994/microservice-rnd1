import type { ServiceDefinition } from "@grpc/grpc-js";
import { Test1Test1Proto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import { GetTest1UseCase } from "../usecases";

export default class Test1GrpcRouter extends GrpcRouter<Test1Test1Proto.Test1ServiceServer> {
	get service(): ServiceDefinition<Test1Test1Proto.Test1ServiceServer> {
		return Test1Test1Proto.Test1ServiceService;
	}

	get handlers(): GrpcHandlerMap<Test1Test1Proto.Test1ServiceServer> {
		return { getTest1: GetTest1UseCase };
	}
}
