import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemGrpcClient from "../clients/ItemGrpcClient";

type Item = Server1GrpcServer1GrpcProto.Item;

interface Input {
	name: string;
}

export default class CreateItemUseCase extends BaseUseCase<Input, Item> {
	private readonly itemGrpcClient: ItemGrpcClient;

	constructor({ itemGrpcClient }: { itemGrpcClient: ItemGrpcClient }) {
		super();
		this.itemGrpcClient = itemGrpcClient;
	}

	async execute({ name }: Input): Promise<Item> {
		return this.itemGrpcClient.createItem(name);
	}
}
