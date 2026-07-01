import { credentials, type ServiceError } from "@grpc/grpc-js";
import { Demo1Demo1Proto, Demo1GoogleProtobuf, type Demo1Graphql } from "api";
import { BaseUseCase } from "lib";

const client = new Demo1Demo1Proto.DemoServiceClient(
	"localhost:5001",
	credentials.createInsecure(),
);

export default class Demo1QueryUseCase extends BaseUseCase<
	Record<string, never>,
	Demo1Graphql.Demo1
> {
	async execute(_input: Record<string, never>): Promise<Demo1Graphql.Demo1> {
		return new Promise((resolve, reject) => {
			client.testDemo(
				Demo1GoogleProtobuf.Empty.create(),
				(err: ServiceError | null, res: Demo1Demo1Proto.Demo1) => {
					if (err) reject(err);
					else resolve({ id: res.id, name: res.name });
				},
			);
		});
	}
}
