import { ServerApp } from "lib/application";
import { GraphqlServer, GrpcServer } from "lib/server";
import { DemoGraphqlController, DemoGrpcController } from "./controllers";

export default async function main() {
	const grpcServer = new GrpcServer({ port: 4001 }).withController(
		new DemoGrpcController(),
	);
	const graphqlServer = new GraphqlServer({
		port: 5001,
		federation: true,
	}).withController(new DemoGraphqlController("localhost:4001"));

	await ServerApp.init(grpcServer).withSideCar(graphqlServer).run();
}
