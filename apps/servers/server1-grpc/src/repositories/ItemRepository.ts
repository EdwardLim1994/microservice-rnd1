import type { RedisClient } from "bun";
import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export interface ItemRecord {
	id: string;
	name: string;
	createdAt: string;
}

const cacheKey = (id: string) => `item:${id}`;

export default class ItemRepository extends BaseRepository<PrismaClient> {
	private readonly redis: RedisClient;

	constructor({ prisma, redis }: { prisma: PrismaClient; redis: RedisClient }) {
		super({ prisma });
		this.redis = redis;
	}

	async create(name: string): Promise<ItemRecord> {
		const item = await this.prisma.item.create({ data: { name } });
		const record = { ...item, createdAt: item.createdAt.toISOString() };
		await this.redis.set(cacheKey(record.id), JSON.stringify(record));
		return record;
	}

	async update(id: string, name: string): Promise<ItemRecord> {
		const item = await this.prisma.item.update({ where: { id }, data: { name } });
		const record = { ...item, createdAt: item.createdAt.toISOString() };
		await this.redis.set(cacheKey(id), JSON.stringify(record));
		return record;
	}

	async delete(id: string): Promise<void> {
		await this.prisma.item.delete({ where: { id } });
		await this.redis.del(cacheKey(id));
	}

	/** Cache-aside: serves from Redis on a hit, otherwise falls through to Postgres and repopulates. */
	async findById(id: string): Promise<ItemRecord | null> {
		const cached = await this.redis.get(cacheKey(id));
		if (cached) return JSON.parse(cached);

		const item = await this.prisma.item.findUnique({ where: { id } });
		if (!item) return null;

		const record = { ...item, createdAt: item.createdAt.toISOString() };
		await this.redis.set(cacheKey(id), JSON.stringify(record));
		return record;
	}

	async findAll(): Promise<ItemRecord[]> {
		const items = await this.prisma.item.findMany();
		return items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
	}
}
