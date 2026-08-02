import { status } from "@grpc/grpc-js";
import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2Repository from "../repositories/Item2Repository";

type GetItem2Request = Server2GrpcServer2GrpcProto.GetItem2Request;
type Item2 = Server2GrpcServer2GrpcProto.Item2;

export default class GetItem2UseCase extends BaseUseCase<
	GetItem2Request,
	Item2
> {
	private readonly item2Repository: Item2Repository;

	constructor({ item2Repository }: { item2Repository: Item2Repository }) {
		super();
		this.item2Repository = item2Repository;
	}

	async execute({ id }: GetItem2Request): Promise<Item2> {
		const item2 = await this.item2Repository.findById(id);
		if (!item2) {
			throw Object.assign(new Error(`Item2 not found: ${id}`), {
				code: status.NOT_FOUND,
			});
		}
		return { $type: "server2_grpc.Item2", ...item2 };
	}
}
