import { BaseRepository } from "lib";
import type { PrismaClient } from "../generated/prisma";

export default class DemoRepository extends BaseRepository<PrismaClient> {
	constructor({ prisma }: { prisma: PrismaClient }) {
		super({ prisma });
	}

	create(name: string) {
		return this.prisma.demo.create({
			data: { name },
		});
	}
}
