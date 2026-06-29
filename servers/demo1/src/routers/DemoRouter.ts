import {
	credentials,
	type ServerUnaryCall,
	type ServiceError,
	type sendUnaryData,
} from "@grpc/grpc-js";
import { Demo1Demo1Proto, Demo1GoogleProtobuf, Demo1Graphql } from "api";
import { parse } from "graphql";
import { GraphqlRouter, GrpcRouter } from "lib/router";

export class DemoGrpcRouter extends GrpcRouter<Demo1Demo1Proto.DemoServiceServer> {
	constructor() {
		super(Demo1Demo1Proto.DemoServiceService);
	}

	public implementation(): Demo1Demo1Proto.DemoServiceServer {
		return {
			testDemo: this.testDemo,
		};
	}

	private testDemo(
		call: ServerUnaryCall<Demo1GoogleProtobuf.Empty, Demo1Demo1Proto.Demo1>,
		callback: sendUnaryData<Demo1Demo1Proto.Demo1>,
	) {
		callback(
			null,
			Demo1Demo1Proto.Demo1.create({
				id: "hello world",
				name: "Hello World Tester",
			}),
		);
	}
}

export class DemoGraphqlRouter extends GraphqlRouter<Demo1Graphql.Demo1ContextType> {
	constructor(
		demoServiceAddress: string,
		private readonly client: Demo1Demo1Proto.DemoServiceClient = new Demo1Demo1Proto.DemoServiceClient(
			demoServiceAddress,
			credentials.createInsecure(),
		),
	) {
		super(parse(Demo1Graphql.typeDefs));
	}

	protected prepareResolvers(): Demo1Graphql.Resolvers {
		return {
			Query: {
				demo1: () => this.demo(),
			},
		};
	}

	private demo(): Promise<Demo1Graphql.Demo1> {
		return new Promise((resolve, reject) => {
			this.client.testDemo(
				Demo1GoogleProtobuf.Empty.create(),
				(err: ServiceError | null, res: Demo1Demo1Proto.Demo1) => {
					if (err) {
						console.error("Error calling testDemo:", err);
						reject(err);
					} else {
						console.log("Received response from testDemo:", res);
						resolve({ id: res.id, name: res.name });
					}
				},
			);
		});
	}
}
