import { credentials, type ServerUnaryCall, type ServiceError, type sendUnaryData } from "@grpc/grpc-js";
import type { Demo1ContextType } from "api/generated/demo1/graphql/context";
import type {
	Demo1 as Demo1Graphql,
	Resolvers,
} from "api/generated/demo1/graphql/resolvers";
import { typeDefs as demo1TypeDefs } from "api/generated/demo1/graphql/typedefs";
import {
	Demo1,
	DemoServiceClient,
	type DemoServiceServer,
	DemoServiceService,
} from "api/generated/demo1/proto/demo1";
import { Empty } from "api/generated/demo1/proto/google/protobuf/empty";
import { parse } from "graphql";
import { GraphqlController, GrpcController } from "lib/controllers";

export class DemoGrpcController extends GrpcController<DemoServiceServer> {
	constructor() {
		super(DemoServiceService);
	}

	public implementation(): DemoServiceServer {
		return {
			testDemo: this.testDemo,
		};
	}

	private testDemo(
		call: ServerUnaryCall<Empty, Demo1>,
		callback: sendUnaryData<Demo1>,
	) {
		callback(null, Demo1.create({ id: "hello world", name: "Hello World Tester" }));
	}
}

export class DemoGraphqlController extends GraphqlController<Demo1ContextType> {
  private client: DemoServiceClient;

  constructor(demoServiceAddress: string) {
    super(parse(demo1TypeDefs));
    this.client = new DemoServiceClient(demoServiceAddress, credentials.createInsecure());
  }

  protected prepareResolvers(): Resolvers {
    return {
      Query: {
        demo: () => this.demo(),
      },
    };
  }

  private demo(): Promise<Demo1Graphql> {
    return new Promise((resolve, reject) => {
      this.client.testDemo(Empty.create(), (err: ServiceError | null, res: Demo1) => {
        if (err) reject(err);
        else resolve({ id: res.id, name: res.name });
      });
    });
  }
}
