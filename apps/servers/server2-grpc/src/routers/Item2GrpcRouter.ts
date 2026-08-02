import type { ServiceDefinition } from "@grpc/grpc-js";
import { Server2GrpcServer2GrpcProto } from "api";
import { type GrpcHandlerMap, GrpcRouter } from "server";
import CreateItem2UseCase from "../usecases/CreateItem2UseCase";
import DeleteItem2UseCase from "../usecases/DeleteItem2UseCase";
import GetItem2UseCase from "../usecases/GetItem2UseCase";
import ListItem2sByItemUseCase from "../usecases/ListItem2sByItemUseCase";
import ListItem2sUseCase from "../usecases/ListItem2sUseCase";
import UpdateItem2UseCase from "../usecases/UpdateItem2UseCase";

type Item2ServiceServer = Server2GrpcServer2GrpcProto.Item2ServiceServer;

export default class Item2GrpcRouter extends GrpcRouter<Item2ServiceServer> {
	get service(): ServiceDefinition<Item2ServiceServer> {
		return Server2GrpcServer2GrpcProto.Item2ServiceService as unknown as ServiceDefinition<Item2ServiceServer>;
	}

	get handlers(): GrpcHandlerMap<Item2ServiceServer> {
		return {
			getItem2: GetItem2UseCase,
			createItem2: CreateItem2UseCase,
			updateItem2: UpdateItem2UseCase,
			deleteItem2: DeleteItem2UseCase,
			listItem2S: ListItem2sUseCase,
			listItem2SByItem: ListItem2sByItemUseCase,
		};
	}
}
