import { credentials, type ServerUnaryCall, type ServiceError, type sendUnaryData } from "@grpc/grpc-js";
import type { Demo2ContextType } from "api/generated/demo2/graphql/context";
import type {
  Demo2 as Demo2Graphql,
  Resolvers,
} from "api/generated/demo2/graphql/resolvers";
import { typeDefs as demo2TypeDefs } from "api/generated/demo2/graphql/typedefs";
import {
  Demo2,
  DemoServiceClient,
  type DemoServiceServer,
  DemoServiceService,
} from "api/generated/demo2/proto/demo2";
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
    call: ServerUnaryCall<Empty, Demo2>,
    callback: sendUnaryData<Demo2>,
  ) {
    callback(null, Demo2.create({ id: "hello world", name: "Hello World Tester" }));
  }
}

export class DemoGraphqlController extends GraphqlController<Demo2ContextType> {
  private readonly client: DemoServiceClient;

  constructor(demoServiceAddress: string) {
    super(parse(demo2TypeDefs));
    this.client = new DemoServiceClient(demoServiceAddress, credentials.createInsecure());
  }

  protected prepareResolvers(): Resolvers {
    return {
      Query: {
        demo2: () => this.demo()
      },
      Demo1: {
        __resolveReference: (ref: { id: string }) => ref,
        demo2: () => this.demo().then(d => [d])
      }
    };
  }

  private demo(): Promise<Demo2Graphql> {
    return new Promise((resolve, reject) => {
      this.client.testDemo(Empty.create(), (err: ServiceError | null, res: Demo2) => {
        if (err) {
          console.error("Error calling testDemo:", err);
          reject(err);
        }
        else {
          console.log("Received response from testDemo:", res);
          resolve({ id: res.id, name: res.name });
        }
      });
    });
  }
}
