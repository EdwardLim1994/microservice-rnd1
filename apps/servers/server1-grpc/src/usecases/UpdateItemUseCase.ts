import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemRepository from "../repositories/ItemRepository";

type UpdateItemRequest = Server1GrpcServer1GrpcProto.UpdateItemRequest;
type Item = Server1GrpcServer1GrpcProto.Item;

export default class UpdateItemUseCase extends BaseUseCase<UpdateItemRequest, Item> {
	private readonly itemRepository: ItemRepository;

	constructor({ itemRepository }: { itemRepository: ItemRepository }) {
		super();
		this.itemRepository = itemRepository;
	}

	async execute({ id, name }: UpdateItemRequest): Promise<Item> {
		const item = await this.itemRepository.update(id, name);
		return { $type: "server1_grpc.Item", ...item };
	}
}
