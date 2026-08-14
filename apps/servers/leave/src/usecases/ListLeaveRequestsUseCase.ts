import type {
	ListLeaveRequestsRequest,
	ListLeaveRequestsResponse,
} from "api/src/generated/leave/proto/leave";
import { BaseUseCase } from "server";
import type { LeaveRepository } from "../repositories/LeaveRepository";
import { toProtoLeaveRequest } from "./helpers";

const STATUS_MAP: Record<number, "PENDING" | "APPROVED" | "REJECTED"> = {
	0: "PENDING",
	1: "APPROVED",
	2: "REJECTED",
};

export class ListLeaveRequestsUseCase extends BaseUseCase<
	ListLeaveRequestsRequest,
	ListLeaveRequestsResponse
> {
	constructor(private readonly deps: { leaveRepository: LeaveRepository }) {
		super();
	}

	async execute(
		req: ListLeaveRequestsRequest,
	): Promise<ListLeaveRequestsResponse> {
		const page = req.page ?? 1;
		const pageSize = req.pageSize ?? 20;
		const status =
			req.status !== undefined ? STATUS_MAP[req.status] : undefined;

		const { requests, total } =
			await this.deps.leaveRepository.listLeaveRequests({
				employeeId: req.employeeId,
				status,
				page,
				pageSize,
			});

		return {
			$type: "leave.ListLeaveRequestsResponse",
			leaveRequests: requests.map(toProtoLeaveRequest),
			total,
		};
	}
}
