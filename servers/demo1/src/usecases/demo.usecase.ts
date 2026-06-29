import {
	credentials,
	type ServerUnaryCall,
	type ServiceError,
	type sendUnaryData,
} from "@grpc/grpc-js";
import { Demo1Demo1Proto, Demo1GoogleProtobuf, type Demo1Graphql } from "api";

const demo1Client = new Demo1Demo1Proto.DemoServiceClient(
	"localhost:5001",
	credentials.createInsecure(),
);

export const testDemo = async (
	call: ServerUnaryCall<Demo1GoogleProtobuf.Empty, Demo1Demo1Proto.Demo1>,
	callback: sendUnaryData<Demo1Demo1Proto.Demo1>,
) => {
	callback(
		null,
		Demo1Demo1Proto.Demo1.create({
			id: "hello world",
			name: "Hello World Tester",
		}),
	);
};

export const demo1 = (): Promise<Demo1Graphql.Demo1> => {
	return new Promise((resolve, reject) => {
		demo1Client.testDemo(
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
};
