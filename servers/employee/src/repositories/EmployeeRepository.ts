import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export interface CreateEmployeeData {
	firstName: string;
	lastName: string;
	gender: string;
	email: string;
	grossSalary: number;
	salaryPerDay: number;
	supervisorId?: string;
	authentikUserId?: string;
}

export default class EmployeeRepository extends BaseRepository<PrismaClient> {
	constructor({ prisma }: { prisma: PrismaClient }) {
		super({ prisma });
	}

	create(data: CreateEmployeeData) {
		return this.prisma.employee.create({ data });
	}

	findById(id: string) {
		return this.prisma.employee.findUnique({ where: { id } });
	}

	findByEmail(email: string) {
		return this.prisma.employee.findUnique({ where: { email } });
	}

	delete(id: string) {
		return this.prisma.employee.delete({ where: { id } });
	}

	findAll() {
		return this.prisma.employee.findMany();
	}
}
