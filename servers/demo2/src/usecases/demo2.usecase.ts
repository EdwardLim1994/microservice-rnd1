import {
	credentials,
	type ServerUnaryCall,
	type ServiceError,
	type sendUnaryData,
} from "@grpc/grpc-js";
import { Demo1GoogleProtobuf, Demo2Demo2Proto, type Demo2Graphql } from "api";

const demo2Client = new Demo2Demo2Proto.DemoServiceClient(
	"localhost:5002",
	credentials.createInsecure(),
);
export const testDemo = (
	call: ServerUnaryCall<Demo1GoogleProtobuf.Empty, Demo2Demo2Proto.Demo2>,
	callback: sendUnaryData<Demo2Demo2Proto.Demo2>,
) => {
	callback(
		null,
		Demo2Demo2Proto.Demo2.create({
			id: "hello world",
			name: "Hello World Tester",
		}),
	);
};

export const demo2 = (): Promise<Demo2Graphql.Demo2> => {
	return new Promise((resolve, reject) => {
		demo2Client.testDemo(
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
};
