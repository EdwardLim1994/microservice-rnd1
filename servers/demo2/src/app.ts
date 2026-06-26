import { ServerApp } from "lib/application"
import { GraphqlServer, GrpcServer } from "lib/server"
import { DemoGraphqlController, DemoGrpcController } from "./controllers";

export default async function main() {
  const grpcServer = new GrpcServer({ port: 4002 }).controller(new DemoGrpcController())
  const graphqlServer = new GraphqlServer({ port: 5002, federation: true }).withController(new DemoGraphqlController("localhost:4002"))

  await ServerApp.init(grpcServer).withSideCar(graphqlServer).run();
}
