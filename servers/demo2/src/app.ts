import { ServerApp } from "lib/application";
import { GraphqlServer, GrpcServer } from "lib/server";
import { DemoGraphqlRouter, DemoGrpcRouter } from "./routers";

export default async function main() {
	const grpcServer = new GrpcServer({ port: 4002 }).withController(
		new DemoGrpcRouter(),
	);
	const graphqlServer = new GraphqlServer({
		port: 5002,
		federation: true,
	}).withController(new DemoGraphqlRouter("localhost:4002"));

	await ServerApp.init(grpcServer).withSideCar(graphqlServer).run();
}
