import type { Test1Test1Proto } from "api";
import { BaseUseCase } from "server";
import type Test1GrpcClient from "../clients/Test1GrpcClient";

export default class GetTest1FromGrpcUseCase extends BaseUseCase<
	Record<string, never>,
	Test1Test1Proto.Test1
> {
	private readonly test1GrpcClient: Test1GrpcClient;

	constructor({ test1GrpcClient }: { test1GrpcClient: Test1GrpcClient }) {
		super();
		this.test1GrpcClient = test1GrpcClient;
	}

	async execute(): Promise<Test1Test1Proto.Test1> {
		return new Promise((resolve, reject) => {
			this.test1GrpcClient.getTest1({ $type: "google.protobuf.Empty" }, (err, res) => {
				if (err) return reject(err);
				resolve(res);
			});
		});
	}
}
