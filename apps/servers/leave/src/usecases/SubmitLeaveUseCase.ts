import type {
	SubmitLeaveRequest,
	SubmitLeaveResponse,
} from "api/src/generated/leave/proto/leave";
import { BaseUseCase } from "server";
import type { LeaveRepository } from "../repositories/LeaveRepository";
import {
	computeDays,
	grpcInvalidArg,
	toProtoBalance,
	toProtoLeaveRequest,
} from "./helpers";

export class SubmitLeaveUseCase extends BaseUseCase<
	SubmitLeaveRequest,
	SubmitLeaveResponse
> {
	constructor(private readonly deps: { leaveRepository: LeaveRepository }) {
		super();
	}

	async execute(req: SubmitLeaveRequest): Promise<SubmitLeaveResponse> {
		if (!req.startDate || !req.endDate)
			throw grpcInvalidArg("startDate and endDate are required");
		const start = req.startDate as Date;
		const end = req.endDate as Date;
		if (end <= start) throw grpcInvalidArg("endDate must be after startDate");

		const totalDays = computeDays(start, end);
		const year = start.getFullYear();
		const repo = this.deps.leaveRepository;

		// proto numeric enums: 0=ANNUAL, 1=SICK, 2=UNPAID
		const leaveTypeStr =
			req.leaveType === 0 ? "ANNUAL" : req.leaveType === 1 ? "SICK" : "UNPAID";

		let paidDays = totalDays;
		let unpaidDays = 0;

		if (leaveTypeStr === "ANNUAL" || leaveTypeStr === "SICK") {
			const balance = await repo.getOrCreateBalance(req.employeeId, year);
			const remaining =
				leaveTypeStr === "ANNUAL"
					? balance.annualRemaining
					: balance.sickRemaining;

			if (remaining <= 0) {
				// All days become unpaid
				paidDays = 0;
				unpaidDays = totalDays;
			} else if (totalDays > remaining) {
				// Partial: use remaining paid days, rest unpaid
				paidDays = remaining;
				unpaidDays = totalDays - remaining;
			}

			if (paidDays > 0) {
				const field =
					leaveTypeStr === "ANNUAL" ? "annualRemaining" : "sickRemaining";
				await repo.deductBalance(req.employeeId, year, field, paidDays);
			}
		} else {
			// UNPAID: all days unpaid
			unpaidDays = totalDays;
			paidDays = 0;
		}

		const leaveRequest = await repo.createLeaveRequest({
			employeeId: req.employeeId,
			leaveType: leaveTypeStr,
			startDate: start,
			endDate: end,
			days: totalDays,
			unpaidDays,
		});

		const balance = await repo.getOrCreateBalance(req.employeeId, year);

		return {
			$type: "leave.SubmitLeaveResponse",
			leaveRequest: toProtoLeaveRequest(leaveRequest),
			balance: toProtoBalance(balance),
		};
	}
}
