import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2Repository from "../repositories/Item2Repository";

type CreateItem2Request = Server2GrpcServer2GrpcProto.CreateItem2Request;
type Item2 = Server2GrpcServer2GrpcProto.Item2;

export default class CreateItem2UseCase extends BaseUseCase<
	CreateItem2Request,
	Item2
> {
	private readonly item2Repository: Item2Repository;

	constructor({ item2Repository }: { item2Repository: Item2Repository }) {
		super();
		this.item2Repository = item2Repository;
	}

	async execute({ name, itemId }: CreateItem2Request): Promise<Item2> {
		const item2 = await this.item2Repository.create(name, itemId);
		return { $type: "server2_grpc.Item2", ...item2 };
	}
}
