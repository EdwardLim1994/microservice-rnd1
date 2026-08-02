import type { MeiliSearch } from "meilisearch";
import { BaseUseCase } from "server";

const ITEM2_SEARCH_INDEX = "item2";

interface Item2Row {
	id: string;
	name: string;
	itemId: string;
	// Debezium's default time.precision.mode is "adaptive": a TIMESTAMP(0-3) column (Prisma's
	// DateTime maps to TIMESTAMP(3)) serializes as io.debezium.time.Timestamp — epoch
	// milliseconds, a plain number, not io.debezium.time.MicroTimestamp (micros) and not an ISO
	// string. Confirmed the hard way: dividing by 1000 here once produced 1970 dates.
	createdAt: number | string;
}

interface DebeziumChangeEvent {
	payload: {
		/** "c" create, "u" update, "d" delete, "r" snapshot read. */
		op: string;
		after: Item2Row | null;
	};
}

function toIso(value: number | string): string {
	return typeof value === "string" ? value : new Date(value).toISOString();
}

/** Indexes Item2 rows into Meilisearch straight off Debezium's CDC stream — no app-level Kafka
 * produce needed (see Item2Repository), Debezium captures every insert directly off Postgres's
 * WAL. Only handles "c" (create) — matches "index every time a new record is created"; updates,
 * deletes, and the initial snapshot's "r" reads are ignored. */
export default class IndexItem2FromDebeziumUseCase extends BaseUseCase<
	DebeziumChangeEvent,
	void
> {
	private readonly meilisearch: MeiliSearch;

	constructor({ meilisearch }: { meilisearch: MeiliSearch }) {
		super();
		this.meilisearch = meilisearch;
	}

	async execute({ payload }: DebeziumChangeEvent): Promise<void> {
		if (payload.op !== "c" || !payload.after) return;
		const { id, name, itemId, createdAt } = payload.after;
		// primaryKey must be explicit — "id" and "itemId" both end in "id", so Meilisearch can't
		// auto-infer one and fails the whole addDocuments task (index_primary_key_multiple_candidates_found).
		await this.meilisearch
			.index(ITEM2_SEARCH_INDEX)
			.addDocuments([{ id, name, itemId, createdAt: toIso(createdAt) }], {
				primaryKey: "id",
			});
	}
}
