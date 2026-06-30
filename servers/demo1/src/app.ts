import { ApolloDriver, GrpcDriver, ServerApp } from "lib";
import { DemoGraphqlRouter, DemoGrpcRouter } from "./routers";

export default async function main() {
	await Promise.all([
		ServerApp.init(GrpcDriver)
			.routers([DemoGrpcRouter])
			.port(5001)
			.run((port, host) => console.log(`gRPC running on ${host}:${port}`)),

		ServerApp.init(ApolloDriver)
			.routers([DemoGraphqlRouter])
			.port(4001)
			.run((port, host) => console.log(`GraphQL running on ${host}:${port}`)),
	]);
}
