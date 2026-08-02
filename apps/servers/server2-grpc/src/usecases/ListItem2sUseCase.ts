import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2Repository from "../repositories/Item2Repository";

type ListItem2sRequest = Server2GrpcServer2GrpcProto.ListItem2sRequest;
type ListItem2sResponse = Server2GrpcServer2GrpcProto.ListItem2sResponse;

export default class ListItem2sUseCase extends BaseUseCase<
	ListItem2sRequest,
	ListItem2sResponse
> {
	private readonly item2Repository: Item2Repository;

	constructor({ item2Repository }: { item2Repository: Item2Repository }) {
		super();
		this.item2Repository = item2Repository;
	}

	async execute(): Promise<ListItem2sResponse> {
		const item2s = await this.item2Repository.findAll();
		return {
			$type: "server2_grpc.ListItem2sResponse",
			item2s: item2s.map((item2) => ({
				$type: "server2_grpc.Item2" as const,
				...item2,
			})),
		};
	}
}
