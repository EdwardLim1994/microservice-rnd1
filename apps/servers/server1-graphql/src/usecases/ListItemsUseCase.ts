import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemGrpcClient from "../clients/ItemGrpcClient";

type Item = Server1GrpcServer1GrpcProto.Item;

export default class ListItemsUseCase extends BaseUseCase<void, Item[]> {
	private readonly itemGrpcClient: ItemGrpcClient;

	constructor({ itemGrpcClient }: { itemGrpcClient: ItemGrpcClient }) {
		super();
		this.itemGrpcClient = itemGrpcClient;
	}

	async execute(): Promise<Item[]> {
		return this.itemGrpcClient.listItems();
	}
}
