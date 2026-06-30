import { ServerApp } from "lib/application";
import { GraphqlServer, GrpcServer } from "lib/server";
import { DemoGraphqlRouter, DemoGrpcRouter } from "./routers";

export default async function main() {
	const grpcServer = new GrpcServer({ port: 5002 }).withRouter(
		new DemoGrpcRouter(),
	);
	const graphqlServer = new GraphqlServer({
		port: 4002,
		federation: true,
	}).withRouter(new DemoGraphqlRouter());

	await ServerApp.init(grpcServer).withSideCar(graphqlServer).run();
}
