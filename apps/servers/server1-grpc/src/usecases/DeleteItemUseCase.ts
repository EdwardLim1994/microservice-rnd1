import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemRepository from "../repositories/ItemRepository";

type DeleteItemRequest = Server1GrpcServer1GrpcProto.DeleteItemRequest;
type DeleteItemResponse = Server1GrpcServer1GrpcProto.DeleteItemResponse;

export default class DeleteItemUseCase extends BaseUseCase<DeleteItemRequest, DeleteItemResponse> {
	private readonly itemRepository: ItemRepository;

	constructor({ itemRepository }: { itemRepository: ItemRepository }) {
		super();
		this.itemRepository = itemRepository;
	}

	async execute({ id }: DeleteItemRequest): Promise<DeleteItemResponse> {
		await this.itemRepository.delete(id);
		return { $type: "server1_grpc.DeleteItemResponse", success: true };
	}
}
