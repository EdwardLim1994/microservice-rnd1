import { Demo1Demo1Proto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "lib";
import { TestDemoUseCase } from "../usecases";

export default class DemoRouter extends GrpcRouter<Demo1Demo1Proto.DemoServiceServer> {
	get service() {
		return Demo1Demo1Proto.DemoServiceService;
	}

	get handlers(): GrpcHandlerMap<Demo1Demo1Proto.DemoServiceServer> {
		return {
			testDemo: TestDemoUseCase,
		};
	}
}
