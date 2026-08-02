import type { MeiliSearch } from "meilisearch";
import { BaseUseCase } from "server";

const ITEM2_SEARCH_INDEX = "item2";

interface Input {
	query: string;
}

interface Item2SearchHit {
	id: string;
	name: string;
	itemId: string;
	createdAt: string;
}

export default class SearchItem2UseCase extends BaseUseCase<
	Input,
	Item2SearchHit[]
> {
	private readonly meilisearch: MeiliSearch;

	constructor({ meilisearch }: { meilisearch: MeiliSearch }) {
		super();
		this.meilisearch = meilisearch;
	}

	async execute({ query }: Input): Promise<Item2SearchHit[]> {
		const result = await this.meilisearch
			.index<Item2SearchHit>(ITEM2_SEARCH_INDEX)
			.search(query);
		return result.hits;
	}
}
