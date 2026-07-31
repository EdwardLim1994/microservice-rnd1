import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import CreateItemUseCase from "../usecases/CreateItemUseCase";
import DeleteItemUseCase from "../usecases/DeleteItemUseCase";
import GetItemUseCase from "../usecases/GetItemUseCase";
import ListItemsUseCase from "../usecases/ListItemsUseCase";
import UpdateItemUseCase from "../usecases/UpdateItemUseCase";

export default class ItemGraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return `
			extend schema @link(url: "https://specs.apollo.dev/federation/v2.14", import: ["@key"])

			type Item @key(fields: "id") {
				id: ID!
				name: String!
				createdAt: String!
			}

			type Query {
				item(id: ID!): Item
				items: [Item!]!
			}

			type Mutation {
				createItem(name: String!): Item!
				updateItem(id: ID!, name: String!): Item!
				deleteItem(id: ID!): Boolean!
			}
		`;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: { item: GetItemUseCase, items: ListItemsUseCase },
			Mutation: {
				createItem: CreateItemUseCase,
				updateItem: UpdateItemUseCase,
				deleteItem: DeleteItemUseCase,
			},
			// Lets other federated subgraphs (and Apollo Router's own _entities query) resolve an
			// Item by its @key(fields: "id") reference, e.g. `{ __typename: "Item", id }`.
			Item: { __resolveReference: GetItemUseCase },
		};
	}
}
