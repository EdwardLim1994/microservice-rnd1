import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export default class PayslipRepository extends BaseRepository<PrismaClient> {
	constructor({ prisma }: { prisma: PrismaClient }) {
		super({ prisma });
	}

	findById(id: string) {
		return this.prisma.payslip.findUnique({ where: { id } });
	}

	findByEmployeeAndPeriod(employeeId: string, month: number, year: number) {
		return this.prisma.payslip.findUnique({
			where: { employeeId_month_year: { employeeId, month, year } },
		});
	}

	findByEmployee(employeeId: string) {
		return this.prisma.payslip.findMany({
			where: { employeeId },
			orderBy: [{ year: "desc" }, { month: "desc" }],
		});
	}

	upsert(data: {
		employeeId: string;
		month: number;
		year: number;
		minioObjectKey: string;
	}) {
		return this.prisma.payslip.upsert({
			where: {
				employeeId_month_year: {
					employeeId: data.employeeId,
					month: data.month,
					year: data.year,
				},
			},
			create: data,
			update: { minioObjectKey: data.minioObjectKey, generatedAt: new Date() },
		});
	}
}
