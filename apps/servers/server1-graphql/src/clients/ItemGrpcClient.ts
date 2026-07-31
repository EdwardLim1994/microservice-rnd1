import { credentials } from "@grpc/grpc-js";
import { Server1GrpcServer1GrpcProto } from "api";

type Item = Server1GrpcServer1GrpcProto.Item;
type ItemServiceClient = Server1GrpcServer1GrpcProto.ItemServiceClient;

const ITEM_GRPC_ADDRESS = process.env.ITEM_GRPC_ADDRESS ?? "server1-grpc:5001";

export default class ItemGrpcClient {
	private readonly client: ItemServiceClient;

	constructor() {
		this.client = new Server1GrpcServer1GrpcProto.ItemServiceClient(
			ITEM_GRPC_ADDRESS,
			credentials.createInsecure(),
		);
	}

	getItem(id: string): Promise<Item> {
		return new Promise((resolve, reject) => {
			this.client.getItem(
				{ $type: "server1_grpc.GetItemRequest", id },
				(err, res) => (err ? reject(err) : resolve(res)),
			);
		});
	}

	createItem(name: string): Promise<Item> {
		return new Promise((resolve, reject) => {
			this.client.createItem(
				{ $type: "server1_grpc.CreateItemRequest", name },
				(err, res) => (err ? reject(err) : resolve(res)),
			);
		});
	}

	updateItem(id: string, name: string): Promise<Item> {
		return new Promise((resolve, reject) => {
			this.client.updateItem(
				{ $type: "server1_grpc.UpdateItemRequest", id, name },
				(err, res) => (err ? reject(err) : resolve(res)),
			);
		});
	}

	deleteItem(id: string): Promise<boolean> {
		return new Promise((resolve, reject) => {
			this.client.deleteItem(
				{ $type: "server1_grpc.DeleteItemRequest", id },
				(err, res) => (err ? reject(err) : resolve(res.success)),
			);
		});
	}

	listItems(): Promise<Item[]> {
		return new Promise((resolve, reject) => {
			this.client.listItems(
				{ $type: "server1_grpc.ListItemsRequest" },
				(err, res) => (err ? reject(err) : resolve(res.items)),
			);
		});
	}
}
