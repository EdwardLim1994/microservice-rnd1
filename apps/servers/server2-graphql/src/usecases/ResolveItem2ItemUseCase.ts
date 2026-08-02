import { BaseUseCase } from "server";

interface Input {
	itemId: string;
}

interface ItemReference {
	__typename: "Item";
	id: string;
}

/** Item2.item field resolver — returns a federation reference for Apollo Router to resolve the
 * rest of Item's fields from server1-graphql's subgraph. */
export default class ResolveItem2ItemUseCase extends BaseUseCase<
	Input,
	ItemReference
> {
	async execute({ itemId }: Input): Promise<ItemReference> {
		return { __typename: "Item", id: itemId };
	}
}
