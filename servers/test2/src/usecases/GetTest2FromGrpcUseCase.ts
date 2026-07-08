import type { Test2Test2Proto } from "api";
import { BaseUseCase } from "server";
import type Test2GrpcClient from "../clients/Test2GrpcClient";

export default class GetTest2FromGrpcUseCase extends BaseUseCase<
	Record<string, never>,
	Test2Test2Proto.Test2
> {
	private readonly test2GrpcClient: Test2GrpcClient;

	constructor({ test2GrpcClient }: { test2GrpcClient: Test2GrpcClient }) {
		super();
		this.test2GrpcClient = test2GrpcClient;
	}

	async execute(): Promise<Test2Test2Proto.Test2> {
		return new Promise((resolve, reject) => {
			this.test2GrpcClient.getTest2({ $type: "google.protobuf.Empty" }, (err, res) => {
				if (err) return reject(err);
				resolve(res);
			});
		});
	}
}
