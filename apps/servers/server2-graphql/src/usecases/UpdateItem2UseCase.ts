import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2GrpcClient from "../clients/Item2GrpcClient";

type Item2 = Server2GrpcServer2GrpcProto.Item2;

interface Input {
	id: string;
	name: string;
}

export default class UpdateItem2UseCase extends BaseUseCase<Input, Item2> {
	private readonly item2GrpcClient: Item2GrpcClient;

	constructor({ item2GrpcClient }: { item2GrpcClient: Item2GrpcClient }) {
		super();
		this.item2GrpcClient = item2GrpcClient;
	}

	async execute({ id, name }: Input): Promise<Item2> {
		return this.item2GrpcClient.updateItem2(id, name);
	}
}
