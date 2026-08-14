import type {
	GetLeaveBalanceRequest,
	LeaveBalance,
} from "api/src/generated/leave/proto/leave";
import { BaseUseCase } from "server";
import type { LeaveRepository } from "../repositories/LeaveRepository";
import { toProtoBalance } from "./helpers";

export class GetLeaveBalanceUseCase extends BaseUseCase<
	GetLeaveBalanceRequest,
	LeaveBalance
> {
	constructor(private readonly deps: { leaveRepository: LeaveRepository }) {
		super();
	}

	async execute(req: GetLeaveBalanceRequest): Promise<LeaveBalance> {
		const year = new Date().getFullYear();
		const balance = await this.deps.leaveRepository.getOrCreateBalance(
			req.employeeId,
			year,
		);
		return toProtoBalance(balance);
	}
}
