import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export default class NotificationRepository extends BaseRepository<PrismaClient> {
	constructor({ prisma }: { prisma: PrismaClient }) {
		super({ prisma });
	}

	findByEmployee(employeeId: string) {
		return this.prisma.notification.findMany({
			where: { employeeId },
			orderBy: { createdAt: "desc" },
		});
	}

	create(data: { employeeId: string; message: string }) {
		return this.prisma.notification.create({ data });
	}

	findById(id: string) {
		return this.prisma.notification.findUnique({ where: { id } });
	}

	markRead(id: string) {
		return this.prisma.notification.update({ where: { id }, data: { read: true } });
	}
}
