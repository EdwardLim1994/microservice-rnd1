import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2Repository from "../repositories/Item2Repository";

type DeleteItem2Request = Server2GrpcServer2GrpcProto.DeleteItem2Request;
type DeleteItem2Response = Server2GrpcServer2GrpcProto.DeleteItem2Response;

export default class DeleteItem2UseCase extends BaseUseCase<
	DeleteItem2Request,
	DeleteItem2Response
> {
	private readonly item2Repository: Item2Repository;

	constructor({ item2Repository }: { item2Repository: Item2Repository }) {
		super();
		this.item2Repository = item2Repository;
	}

	async execute({ id }: DeleteItem2Request): Promise<DeleteItem2Response> {
		await this.item2Repository.delete(id);
		return { $type: "server2_grpc.DeleteItem2Response", success: true };
	}
}
