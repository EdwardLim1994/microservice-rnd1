import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2GrpcClient from "../clients/Item2GrpcClient";

type Item2 = Server2GrpcServer2GrpcProto.Item2;

interface Input {
	id: string;
}

/** Item.item2s field resolver — parent is the federation reference `{ id }` Apollo Router
 * resolves this Item entity to, since server2-graphql only owns "id" on the Item stub. */
export default class ListItem2sByItemUseCase extends BaseUseCase<
	Input,
	Item2[]
> {
	private readonly item2GrpcClient: Item2GrpcClient;

	constructor({ item2GrpcClient }: { item2GrpcClient: Item2GrpcClient }) {
		super();
		this.item2GrpcClient = item2GrpcClient;
	}

	async execute({ id }: Input): Promise<Item2[]> {
		return this.item2GrpcClient.listItem2sByItemId(id);
	}
}
