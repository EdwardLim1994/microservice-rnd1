import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemRepository from "../repositories/ItemRepository";

type CreateItemRequest = Server1GrpcServer1GrpcProto.CreateItemRequest;
type Item = Server1GrpcServer1GrpcProto.Item;

export default class CreateItemUseCase extends BaseUseCase<CreateItemRequest, Item> {
	private readonly itemRepository: ItemRepository;

	constructor({ itemRepository }: { itemRepository: ItemRepository }) {
		super();
		this.itemRepository = itemRepository;
	}

	async execute({ name }: CreateItemRequest): Promise<Item> {
		const item = await this.itemRepository.create(name);
		return { $type: "server1_grpc.Item", ...item };
	}
}
