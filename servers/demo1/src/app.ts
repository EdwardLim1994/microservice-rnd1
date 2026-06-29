import { ServerApp } from "lib/application";
import { GraphqlServer, GrpcServer } from "lib/server";
import { DemoGraphqlRouter, DemoGrpcRouter } from "./routers";

export default async function main() {
	const grpcServer = new GrpcServer({ port: 5001 }).withController(
		new DemoGrpcRouter(),
	);
	const graphqlServer = new GraphqlServer({
		port: 4001,
		federation: true,
	}).withController(new DemoGraphqlRouter());

	await ServerApp.init(grpcServer).withSideCar(graphqlServer).run();
}
