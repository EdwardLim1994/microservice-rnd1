import type {
	GetUnpaidLeaveDaysRequest,
	GetUnpaidLeaveDaysResponse,
} from "api/src/generated/leave/proto/leave";
import { BaseUseCase } from "server";
import type { LeaveRepository } from "../repositories/LeaveRepository";

export class GetUnpaidLeaveDaysUseCase extends BaseUseCase<
	GetUnpaidLeaveDaysRequest,
	GetUnpaidLeaveDaysResponse
> {
	constructor(private readonly deps: { leaveRepository: LeaveRepository }) {
		super();
	}

	async execute(
		req: GetUnpaidLeaveDaysRequest,
	): Promise<GetUnpaidLeaveDaysResponse> {
		const unpaidDays = await this.deps.leaveRepository.getUnpaidLeaveDays(
			req.employeeId,
			req.year,
			req.month,
		);
		return {
			$type: "leave.GetUnpaidLeaveDaysResponse",
			employeeId: req.employeeId,
			unpaidDays,
		};
	}
}
