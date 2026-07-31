import { Server1GrpcServer1GrpcProto } from "api";
import { BaseUseCase } from "server";
import type ItemRepository from "../repositories/ItemRepository";

type ListItemsRequest = Server1GrpcServer1GrpcProto.ListItemsRequest;
type ListItemsResponse = Server1GrpcServer1GrpcProto.ListItemsResponse;

export default class ListItemsUseCase extends BaseUseCase<ListItemsRequest, ListItemsResponse> {
	private readonly itemRepository: ItemRepository;

	constructor({ itemRepository }: { itemRepository: ItemRepository }) {
		super();
		this.itemRepository = itemRepository;
	}

	async execute(): Promise<ListItemsResponse> {
		const items = await this.itemRepository.findAll();
		return {
			$type: "server1_grpc.ListItemsResponse",
			items: items.map((item) => ({ $type: "server1_grpc.Item" as const, ...item })),
		};
	}
}
