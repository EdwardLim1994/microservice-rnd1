import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2GrpcClient from "../clients/Item2GrpcClient";

type Item2 = Server2GrpcServer2GrpcProto.Item2;

interface Input {
	name: string;
	/** server1's Item id — recognizes item2's parent item over in server1. */
	itemId: string;
}

export default class CreateItem2UseCase extends BaseUseCase<Input, Item2> {
	private readonly item2GrpcClient: Item2GrpcClient;

	constructor({ item2GrpcClient }: { item2GrpcClient: Item2GrpcClient }) {
		super();
		this.item2GrpcClient = item2GrpcClient;
	}

	async execute({ name, itemId }: Input): Promise<Item2> {
		return this.item2GrpcClient.createItem2(name, itemId);
	}
}
