import { BaseRepository } from "server";
import type { PrismaClient } from "../../generated/prisma";

type LeaveRequestRow = {
	id: string;
	employeeId: string;
	leaveType: "ANNUAL" | "SICK" | "UNPAID";
	startDate: Date;
	endDate: Date;
	days: number;
	status: "PENDING" | "APPROVED" | "REJECTED";
	unpaidDays: number;
	createdAt: Date;
	updatedAt: Date;
};

type LeaveBalanceRow = {
	employeeId: string;
	year: number;
	annualRemaining: number;
	sickRemaining: number;
};

const ANNUAL_ENTITLEMENT = 14;
const SICK_ENTITLEMENT = 14;

export class LeaveRepository extends BaseRepository<PrismaClient> {
	async createLeaveRequest(data: {
		employeeId: string;
		leaveType: "ANNUAL" | "SICK" | "UNPAID";
		startDate: Date;
		endDate: Date;
		days: number;
		unpaidDays: number;
	}): Promise<LeaveRequestRow> {
		return this.prisma.leaveRequest.create({ data });
	}

	async updateLeaveStatus(
		id: string,
		status: "APPROVED" | "REJECTED",
	): Promise<LeaveRequestRow> {
		return this.prisma.leaveRequest.update({ where: { id }, data: { status } });
	}

	async findLeaveById(id: string): Promise<LeaveRequestRow | null> {
		return this.prisma.leaveRequest.findUnique({ where: { id } });
	}

	async listLeaveRequests(filters: {
		employeeId?: string;
		status?: "PENDING" | "APPROVED" | "REJECTED";
		page: number;
		pageSize: number;
	}): Promise<{ requests: LeaveRequestRow[]; total: number }> {
		const where = {
			...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
			...(filters.status ? { status: filters.status } : {}),
		};
		const [requests, total] = await this.prisma.$transaction([
			this.prisma.leaveRequest.findMany({
				where,
				skip: (filters.page - 1) * filters.pageSize,
				take: filters.pageSize,
				orderBy: { createdAt: "desc" },
			}),
			this.prisma.leaveRequest.count({ where }),
		]);
		return { requests, total };
	}

	// Returns or lazily creates the balance record for the given employee + year
	async getOrCreateBalance(
		employeeId: string,
		year: number,
	): Promise<LeaveBalanceRow> {
		return this.prisma.leaveBalance.upsert({
			where: { employeeId_year: { employeeId, year } },
			create: {
				employeeId,
				year,
				annualRemaining: ANNUAL_ENTITLEMENT,
				sickRemaining: SICK_ENTITLEMENT,
			},
			update: {},
		});
	}

	async deductBalance(
		employeeId: string,
		year: number,
		field: "annualRemaining" | "sickRemaining",
		amount: number,
	): Promise<LeaveBalanceRow> {
		return this.prisma.leaveBalance.update({
			where: { employeeId_year: { employeeId, year } },
			data: { [field]: { decrement: amount } },
		});
	}

	async getUnpaidLeaveDays(
		employeeId: string,
		year: number,
		month: number,
	): Promise<number> {
		const start = new Date(year, month - 1, 1);
		const end = new Date(year, month, 1);
		const rows = await this.prisma.leaveRequest.findMany({
			where: {
				employeeId,
				status: "APPROVED",
				startDate: { gte: start, lt: end },
				unpaidDays: { gt: 0 },
			},
			select: { unpaidDays: true },
		});
		return rows.reduce((sum, r) => sum + r.unpaidDays, 0);
	}
}
