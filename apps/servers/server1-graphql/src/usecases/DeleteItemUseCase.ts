import { BaseUseCase } from "server";
import type ItemGrpcClient from "../clients/ItemGrpcClient";

interface Input {
	id: string;
}

export default class DeleteItemUseCase extends BaseUseCase<Input, boolean> {
	private readonly itemGrpcClient: ItemGrpcClient;

	constructor({ itemGrpcClient }: { itemGrpcClient: ItemGrpcClient }) {
		super();
		this.itemGrpcClient = itemGrpcClient;
	}

	async execute({ id }: Input): Promise<boolean> {
		return this.itemGrpcClient.deleteItem(id);
	}
}
