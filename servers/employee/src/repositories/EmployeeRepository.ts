import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export default class EmployeeRepository extends BaseRepository<PrismaClient> {
	constructor({ prisma }: { prisma: PrismaClient }) {
		super({ prisma });
	}

	findById(id: string) {
		return this.prisma.employee.findUnique({ where: { id }, include: { supervisor: true } });
	}

	findByEmployeeId(employeeId: string) {
		return this.prisma.employee.findUnique({ where: { employeeId } });
	}

	findMany(where: { department?: string; role?: string }) {
		return this.prisma.employee.findMany({ where, include: { supervisor: true } });
	}

	create(data: {
		employeeId: string;
		fullName: string;
		role: string;
		department: string;
		grossSalary: number;
		supervisorId?: string | null;
	}) {
		return this.prisma.employee.create({ data, include: { supervisor: true } });
	}

	delete(id: string) {
		return this.prisma.employee.delete({ where: { id } });
	}

	updateSupervisor(id: string, supervisorId: string) {
		return this.prisma.employee.update({
			where: { id },
			data: { supervisorId },
			include: { supervisor: true },
		});
	}
}
