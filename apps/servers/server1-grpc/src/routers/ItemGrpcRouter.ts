import type { ServiceDefinition } from "@grpc/grpc-js";
import { Server1GrpcServer1GrpcProto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import CreateItemUseCase from "../usecases/CreateItemUseCase";
import DeleteItemUseCase from "../usecases/DeleteItemUseCase";
import GetItemUseCase from "../usecases/GetItemUseCase";
import ListItemsUseCase from "../usecases/ListItemsUseCase";
import UpdateItemUseCase from "../usecases/UpdateItemUseCase";

type ItemServiceServer = Server1GrpcServer1GrpcProto.ItemServiceServer;

export default class ItemGrpcRouter extends GrpcRouter<ItemServiceServer> {
	get service(): ServiceDefinition<ItemServiceServer> {
		return Server1GrpcServer1GrpcProto.ItemServiceService as unknown as ServiceDefinition<ItemServiceServer>;
	}

	get handlers(): GrpcHandlerMap<ItemServiceServer> {
		return {
			getItem: GetItemUseCase,
			createItem: CreateItemUseCase,
			updateItem: UpdateItemUseCase,
			deleteItem: DeleteItemUseCase,
			listItems: ListItemsUseCase,
		};
	}
}
