import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export default class Test1Repository extends BaseRepository<PrismaClient> {
	constructor({ prisma }: { prisma: PrismaClient }) {
		super({ prisma });
	}

	async create() {
		return this.prisma.test1.create({
			data: {},
		});
	}
}
