import {
	credentials,
	type ServiceError,
} from "@grpc/grpc-js";
import { Demo1GoogleProtobuf, Demo2Demo2Proto, type Demo2Graphql } from "api";
import { BaseUseCase } from "lib";

const client = new Demo2Demo2Proto.DemoServiceClient(
	"localhost:5002",
	credentials.createInsecure(),
);

export default class Demo2QueryUseCase extends BaseUseCase<
	Record<string, never>,
	Demo2Graphql.Demo2
> {
	async execute(_input: Record<string, never>): Promise<Demo2Graphql.Demo2> {
		return new Promise((resolve, reject) => {
			client.testDemo(
				Demo1GoogleProtobuf.Empty.create(),
				(err: ServiceError | null, res: Demo2Demo2Proto.Demo2) => {
					if (err) reject(err);
					else resolve({ id: res.id, name: res.name });
				},
			);
		});
	}
}
