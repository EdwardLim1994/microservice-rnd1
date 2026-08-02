import type { RedisClient } from "bun";
import { BaseRepository, cacheAside, cacheAsideAll, type KafkaProducer } from "server";
import type { PrismaClient } from "../../generated/prisma";
import { ITEM_CREATED_TOPIC } from "../topics";

export interface ItemRecord {
	id: string;
	name: string;
	createdAt: string;
}

const cacheKey = (id: string) => `item:${id}`;

export default class ItemRepository extends BaseRepository<PrismaClient> {
	private readonly redis: RedisClient;
	private readonly kafkaProducer: KafkaProducer;

	constructor({
		prisma,
		redis,
		kafkaProducer,
	}: {
		prisma: PrismaClient;
		redis: RedisClient;
		kafkaProducer: KafkaProducer;
	}) {
		super({ prisma });
		this.redis = redis;
		this.kafkaProducer = kafkaProducer;
	}

	async create(name: string): Promise<ItemRecord> {
		const item = await this.prisma.item.create({ data: { name } });
		const record = { ...item, createdAt: item.createdAt.toISOString() };
		await this.redis.set(cacheKey(record.id), JSON.stringify(record));
		await this.kafkaProducer.send(ITEM_CREATED_TOPIC, record);
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

	async findById(id: string): Promise<ItemRecord | null> {
		return cacheAside(this.redis, cacheKey(id), async () => {
			const item = await this.prisma.item.findUnique({ where: { id } });
			if (!item) return null;
			return { ...item, createdAt: item.createdAt.toISOString() };
		});
	}

	async findAll(): Promise<ItemRecord[]> {
		return cacheAsideAll(this.redis, "item:*", cacheKey, async () => {
			const items = await this.prisma.item.findMany();
			return items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }));
		});
	}
}
