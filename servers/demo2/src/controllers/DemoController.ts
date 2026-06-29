import {
	credentials,
	type ServerUnaryCall,
	type ServiceError,
	type sendUnaryData,
} from "@grpc/grpc-js";
import { Demo1GoogleProtobuf, Demo2Demo2Proto, Demo2Graphql } from "api";
import { parse } from "graphql";
import { GraphqlController, GrpcController } from "lib/controller";

export class DemoGrpcController extends GrpcController<Demo2Demo2Proto.DemoServiceServer> {
	constructor() {
		super(Demo2Demo2Proto.DemoServiceService);
	}

	public implementation(): Demo2Demo2Proto.DemoServiceServer {
		return {
			testDemo: this.testDemo,
		};
	}

	private testDemo(
		call: ServerUnaryCall<Demo1GoogleProtobuf.Empty, Demo2Demo2Proto.Demo2>,
		callback: sendUnaryData<Demo2Demo2Proto.Demo2>,
	) {
		callback(
			null,
			Demo2Demo2Proto.Demo2.create({ id: "hello world", name: "Hello World Tester" }),
		);
	}
}

export class DemoGraphqlController extends GraphqlController<Demo2Graphql.Demo2ContextType> {
	private readonly client: Demo2Demo2Proto.DemoServiceClient;

	constructor(demoServiceAddress: string) {
		super(parse(Demo2Graphql.typeDefs));
		this.client = new Demo2Demo2Proto.DemoServiceClient(
			demoServiceAddress,
			credentials.createInsecure(),
		);
	}

	protected prepareResolvers(): Demo2Graphql.Resolvers {
		return {
			Query: {
				demo2: () => this.demo(),
			},
			Demo1: {
				__resolveReference: (ref: { id: string }) => ref,
				demo2: () => this.demo().then((d) => [d]),
			},
		};
	}

	private demo(): Promise<Demo2Graphql.Demo2> {
		return new Promise((resolve, reject) => {
			this.client.testDemo(
				Demo1GoogleProtobuf.Empty.create(),
				(err: ServiceError | null, res: Demo2Demo2Proto.Demo2) => {
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
