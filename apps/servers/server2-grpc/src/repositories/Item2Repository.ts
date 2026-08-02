import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export interface Item2Record {
	id: string;
	name: string;
	itemId: string;
	createdAt: string;
}

// No Kafka producer here anymore — Debezium (apps/servers/server2-grpc-infra/helm/templates/
// debezium.yaml) captures inserts straight off Postgres's WAL and publishes them itself; this
// repository doesn't need to also produce an app-level event for Meilisearch indexing to work.
export default class Item2Repository extends BaseRepository<PrismaClient> {
	async create(name: string, itemId: string): Promise<Item2Record> {
		const item2 = await this.prisma.item2.create({ data: { name, itemId } });
		return { ...item2, createdAt: item2.createdAt.toISOString() };
	}

	async update(id: string, name: string): Promise<Item2Record> {
		const item2 = await this.prisma.item2.update({
			where: { id },
			data: { name },
		});
		return { ...item2, createdAt: item2.createdAt.toISOString() };
	}

	async delete(id: string): Promise<void> {
		await this.prisma.item2.delete({ where: { id } });
	}

	async findById(id: string): Promise<Item2Record | null> {
		const item2 = await this.prisma.item2.findUnique({ where: { id } });
		if (!item2) return null;
		return { ...item2, createdAt: item2.createdAt.toISOString() };
	}

	async findAll(): Promise<Item2Record[]> {
		const item2s = await this.prisma.item2.findMany();
		return item2s.map((item2) => ({
			...item2,
			createdAt: item2.createdAt.toISOString(),
		}));
	}

	/** Backs the federated Item.item2s field — every Item2 that belongs to server1's Item by id. */
	async findByItemId(itemId: string): Promise<Item2Record[]> {
		const item2s = await this.prisma.item2.findMany({ where: { itemId } });
		return item2s.map((item2) => ({
			...item2,
			createdAt: item2.createdAt.toISOString(),
		}));
	}
}
