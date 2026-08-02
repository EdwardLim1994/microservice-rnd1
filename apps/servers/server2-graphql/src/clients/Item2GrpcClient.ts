import { credentials } from "@grpc/grpc-js";
import { Server2GrpcServer2GrpcProto } from "api";

type Item2 = Server2GrpcServer2GrpcProto.Item2;
type Item2ServiceClient = Server2GrpcServer2GrpcProto.Item2ServiceClient;

const SERVER2_GRPC_ADDRESS =
	process.env.SERVER2_GRPC_ADDRESS ?? "server2-grpc:5002";

export default class Item2GrpcClient {
	private readonly client: Item2ServiceClient;

	constructor() {
		this.client = new Server2GrpcServer2GrpcProto.Item2ServiceClient(
			SERVER2_GRPC_ADDRESS,
			credentials.createInsecure(),
		);
	}

	getItem2(id: string): Promise<Item2> {
		return new Promise((resolve, reject) => {
			this.client.getItem2(
				{ $type: "server2_grpc.GetItem2Request", id },
				(err, res) => (err ? reject(err) : resolve(res)),
			);
		});
	}

	createItem2(name: string, itemId: string): Promise<Item2> {
		return new Promise((resolve, reject) => {
			this.client.createItem2(
				{ $type: "server2_grpc.CreateItem2Request", name, itemId },
				(err, res) => (err ? reject(err) : resolve(res)),
			);
		});
	}

	updateItem2(id: string, name: string): Promise<Item2> {
		return new Promise((resolve, reject) => {
			this.client.updateItem2(
				{ $type: "server2_grpc.UpdateItem2Request", id, name },
				(err, res) => (err ? reject(err) : resolve(res)),
			);
		});
	}

	deleteItem2(id: string): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.deleteItem2(
				{ $type: "server2_grpc.DeleteItem2Request", id },
				(err, res) => (err ? reject(err) : resolve(res.success)),
			);
		});
	}

	listItem2s(): Promise<Item2[]> {
		return new Promise((resolve, reject) => {
			this.client.listItem2S(
				{ $type: "server2_grpc.ListItem2sRequest" },
				(err, res) => (err ? reject(err) : resolve(res.item2s)),
			);
		});
	}

	/** Backs the federated Item.item2s field — every Item2 that belongs to server1's Item by id. */
	listItem2sByItemId(itemId: string): Promise<Item2[]> {
		return new Promise((resolve, reject) => {
			this.client.listItem2SByItem(
				{ $type: "server2_grpc.ListItem2sByItemRequest", itemId },
				(err, res) => (err ? reject(err) : resolve(res.item2s)),
			);
		});
	}
}
