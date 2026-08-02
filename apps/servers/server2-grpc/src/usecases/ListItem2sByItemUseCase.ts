import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2Repository from "../repositories/Item2Repository";

type ListItem2sByItemRequest =
	Server2GrpcServer2GrpcProto.ListItem2sByItemRequest;
type ListItem2sResponse = Server2GrpcServer2GrpcProto.ListItem2sResponse;

/** Backs the federated Item.item2s field — every Item2 that belongs to server1's Item by id. */
export default class ListItem2sByItemUseCase extends BaseUseCase<
	ListItem2sByItemRequest,
	ListItem2sResponse
> {
	private readonly item2Repository: Item2Repository;

	constructor({ item2Repository }: { item2Repository: Item2Repository }) {
		super();
		this.item2Repository = item2Repository;
	}

	async execute({
		itemId,
	}: ListItem2sByItemRequest): Promise<ListItem2sResponse> {
		const item2s = await this.item2Repository.findByItemId(itemId);
		return {
			$type: "server2_grpc.ListItem2sResponse",
			item2s: item2s.map((item2) => ({
				$type: "server2_grpc.Item2" as const,
				...item2,
			})),
		};
	}
}
