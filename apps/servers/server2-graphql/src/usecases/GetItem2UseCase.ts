import { status } from "@grpc/grpc-js";
import type { Server2GrpcServer2GrpcProto } from "api";
import { BaseUseCase } from "server";
import type Item2GrpcClient from "../clients/Item2GrpcClient";

type Item2 = Server2GrpcServer2GrpcProto.Item2;

interface Input {
	id: string;
}

/** Backs both `Query.item2` (args as input) and `Item2.__resolveReference`. */
export default class GetItem2UseCase extends BaseUseCase<Input, Item2 | null> {
	private readonly item2GrpcClient: Item2GrpcClient;

	constructor({ item2GrpcClient }: { item2GrpcClient: Item2GrpcClient }) {
		super();
		this.item2GrpcClient = item2GrpcClient;
	}

	async execute({ id }: Input): Promise<Item2 | null> {
		try {
			return await this.item2GrpcClient.getItem2(id);
		} catch (err) {
			if ((err as { code?: number }).code === status.NOT_FOUND) return null;
			throw err;
		}
	}
}
