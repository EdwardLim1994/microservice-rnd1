import { BaseUseCase } from "server";
import type Item2GrpcClient from "../clients/Item2GrpcClient";

interface Input {
	id: string;
}

export default class DeleteItem2UseCase extends BaseUseCase<Input, boolean> {
	private readonly item2GrpcClient: Item2GrpcClient;

	constructor({ item2GrpcClient }: { item2GrpcClient: Item2GrpcClient }) {
		super();
		this.item2GrpcClient = item2GrpcClient;
	}

	async execute({ id }: Input): Promise<boolean> {
		return this.item2GrpcClient.deleteItem2(id);
	}
}
