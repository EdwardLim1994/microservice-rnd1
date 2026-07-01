import { Demo2Demo2Proto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "lib";
import TestDemoUseCase from "../usecases/TestDemoUseCase";

export default class DemoGrpcRouter extends GrpcRouter<Demo2Demo2Proto.DemoServiceServer> {
	get service() {
		return Demo2Demo2Proto.DemoServiceService;
	}

	get handlers(): GrpcHandlerMap<Demo2Demo2Proto.DemoServiceServer> {
		return { testDemo: TestDemoUseCase };
	}
}
