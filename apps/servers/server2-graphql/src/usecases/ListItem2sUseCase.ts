import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2GrpcClient from "../clients/Item2GrpcClient";

type Item2 = Server2GrpcServer2GrpcProto.Item2;

export default class ListItem2sUseCase extends BaseUseCase<void, Item2[]> {
	private readonly item2GrpcClient: Item2GrpcClient;

	constructor({ item2GrpcClient }: { item2GrpcClient: Item2GrpcClient }) {
		super();
		this.item2GrpcClient = item2GrpcClient;
	}

	async execute(): Promise<Item2[]> {
		return this.item2GrpcClient.listItem2s();
	}
}
