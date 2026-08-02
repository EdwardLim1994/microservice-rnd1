import { type GraphqlHandlerMap, GraphqlRouter } from "server";
import CreateItem2UseCase from "../usecases/CreateItem2UseCase";
import DeleteItem2UseCase from "../usecases/DeleteItem2UseCase";
import GetItem2UseCase from "../usecases/GetItem2UseCase";
import ListItem2sByItemUseCase from "../usecases/ListItem2sByItemUseCase";
import ListItem2sUseCase from "../usecases/ListItem2sUseCase";
import ResolveItem2ItemUseCase from "../usecases/ResolveItem2ItemUseCase";
import SearchItem2UseCase from "../usecases/SearchItem2UseCase";
import UpdateItem2UseCase from "../usecases/UpdateItem2UseCase";

export default class Item2GraphqlRouter extends GraphqlRouter {
	get typeDefs(): string {
		return `
			extend schema @link(url: "https://specs.apollo.dev/federation/v2.14", import: ["@key"])

			# Stub reference into server1-graphql's own Item entity — "id" and "item2s" are owned
			# here, the rest of Item's fields are resolved from server1-graphql's subgraph.
			type Item @key(fields: "id") {
				id: ID!
				item2s: [Item2!]!
			}

			type Item2 @key(fields: "id") {
				id: ID!
				name: String!
				itemId: ID!
				createdAt: String!
				item: Item!
			}

			type Item2SearchHit {
				id: ID!
				name: String!
				itemId: ID!
				createdAt: String!
			}

			type Query {
				item2(id: ID!): Item2
				item2s: [Item2!]!
				search(query: String!): [Item2SearchHit!]!
			}

			type Mutation {
				createItem2(name: String!, itemId: ID!): Item2!
				updateItem2(id: ID!, name: String!): Item2!
				deleteItem2(id: ID!): Boolean!
			}
		`;
	}

	get handlers(): GraphqlHandlerMap {
		return {
			Query: {
				item2: GetItem2UseCase,
				item2s: ListItem2sUseCase,
				search: SearchItem2UseCase,
			},
			Mutation: {
				createItem2: CreateItem2UseCase,
				updateItem2: UpdateItem2UseCase,
				deleteItem2: DeleteItem2UseCase,
			},
			Item2: {
				__resolveReference: GetItem2UseCase,
				item: ResolveItem2ItemUseCase,
			},
			Item: {
				item2s: ListItem2sByItemUseCase,
			},
		};
	}
}
