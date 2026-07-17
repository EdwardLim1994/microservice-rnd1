import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

export default class LeaveRequestRepository extends BaseRepository<PrismaClient> {
	constructor({ prisma }: { prisma: PrismaClient }) {
		super({ prisma });
	}

	findById(id: string) {
		return this.prisma.leaveRequest.findUnique({ where: { id } });
	}

	findByEmployee(employeeId: string) {
		return this.prisma.leaveRequest.findMany({
			where: { employeeId },
			orderBy: { submittedAt: "desc" },
		});
	}

	findApprovedOverlapping(employeeId: string, startDate: Date, endDate: Date) {
		return this.prisma.leaveRequest.findFirst({
			where: {
				employeeId,
				status: "APPROVED",
				startDate: { lte: endDate },
				endDate: { gte: startDate },
			},
		});
	}

	create(data: {
		employeeId: string;
		leaveType: "ANNUAL" | "MEDICAL" | "EMERGENCY";
		startDate: Date;
		endDate: Date;
		reason: string;
	}) {
		return this.prisma.leaveRequest.create({ data });
	}

	review(id: string, decision: "APPROVED" | "REJECTED", reviewedById: string) {
		return this.prisma.leaveRequest.update({
			where: { id },
			data: { status: decision, reviewedById, reviewedAt: new Date() },
		});
	}

	findPendingForEmployees(employeeIds: string[]) {
		return this.prisma.leaveRequest.findMany({
			where: { employeeId: { in: employeeIds }, status: "PENDING" },
			orderBy: { submittedAt: "desc" },
		});
	}
}
