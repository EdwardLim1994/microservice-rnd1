import type {
	LeaveStatus,
	LeaveType,
	LeaveBalance as ProtoBalance,
	LeaveRequest as ProtoLeaveRequest,
} from "api/src/generated/leave/proto/leave";

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

const leaveTypeMap: Record<"ANNUAL" | "SICK" | "UNPAID", LeaveType> = {
	ANNUAL: 0,
	SICK: 1,
	UNPAID: 2,
};

const leaveStatusMap: Record<"PENDING" | "APPROVED" | "REJECTED", LeaveStatus> =
	{ PENDING: 0, APPROVED: 1, REJECTED: 2 };

export function toProtoLeaveRequest(row: LeaveRequestRow): ProtoLeaveRequest {
	return {
		$type: "leave.LeaveRequest",
		id: row.id,
		employeeId: row.employeeId,
		leaveType: leaveTypeMap[row.leaveType],
		startDate: row.startDate,
		endDate: row.endDate,
		days: row.days,
		status: leaveStatusMap[row.status],
		unpaidDays: row.unpaidDays,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export function toProtoBalance(row: LeaveBalanceRow): ProtoBalance {
	return {
		$type: "leave.LeaveBalance",
		employeeId: row.employeeId,
		annualRemaining: row.annualRemaining,
		sickRemaining: row.sickRemaining,
	};
}

export function computeDays(start: Date, end: Date): number {
	return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

export function grpcNotFound(id: string): Error {
	return Object.assign(new Error(`Leave request ${id} not found`), { code: 5 });
}

export function grpcInvalidArg(msg: string): Error {
	return Object.assign(new Error(msg), { code: 3 });
}
