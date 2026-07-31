import { status } from "@grpc/grpc-js";
import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemGrpcClient from "../clients/ItemGrpcClient";

type Item = Server1GrpcServer1GrpcProto.Item;

interface Input {
	id: string;
}

/** Backs both `Query.item` (args as input) and `Item.__resolveReference` (the `{ id }`
 * reference object as input) — same shape either way, see GraphqlRouter's resolver dispatch. */
export default class GetItemUseCase extends BaseUseCase<Input, Item | null> {
	private readonly itemGrpcClient: ItemGrpcClient;

	constructor({ itemGrpcClient }: { itemGrpcClient: ItemGrpcClient }) {
		super();
		this.itemGrpcClient = itemGrpcClient;
	}

	async execute({ id }: Input): Promise<Item | null> {
		try {
			return await this.itemGrpcClient.getItem(id);
		} catch (err) {
			if ((err as { code?: number }).code === status.NOT_FOUND) return null;
			throw err;
		}
	}
}
