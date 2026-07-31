import { status } from "@grpc/grpc-js";
import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemRepository from "../repositories/ItemRepository";

type GetItemRequest = Server1GrpcServer1GrpcProto.GetItemRequest;
type Item = Server1GrpcServer1GrpcProto.Item;

export default class GetItemUseCase extends BaseUseCase<GetItemRequest, Item> {
	private readonly itemRepository: ItemRepository;

	constructor({ itemRepository }: { itemRepository: ItemRepository }) {
		super();
		this.itemRepository = itemRepository;
	}

	async execute({ id }: GetItemRequest): Promise<Item> {
		const item = await this.itemRepository.findById(id);
		if (!item) {
			// code: distinguishes "not found" from a real failure for callers (e.g.
			// server1-graphql's gateway resolves this to a null Query result, not a GraphQL error).
			throw Object.assign(new Error(`Item not found: ${id}`), { code: status.NOT_FOUND });
		}
		return { $type: "server1_grpc.Item", ...item };
	}
}
