import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import LeaveRequestRepository from "../repositories/LeaveRequestRepository";

export interface ReviewLeaveInput {
	leaveRequestId: string;
	supervisorId: string;
	decision: "APPROVED" | "REJECTED";
}

export default class ReviewLeaveUseCase extends BaseUseCase<{ input: ReviewLeaveInput }, unknown> {
	private readonly leaveRequestRepository: LeaveRequestRepository;
	private readonly employeeServiceClient: EmployeeServiceClient;

	constructor({
		leaveRequestRepository,
		employeeServiceClient,
	}: {
		leaveRequestRepository: LeaveRequestRepository;
		employeeServiceClient: EmployeeServiceClient;
	}) {
		super();
		this.leaveRequestRepository = leaveRequestRepository;
		this.employeeServiceClient = employeeServiceClient;
	}

	async execute({ input }: { input: ReviewLeaveInput }) {
		const { leaveRequestId, supervisorId, decision } = input;

		const leaveRequest = await this.leaveRequestRepository.findById(leaveRequestId);
		if (!leaveRequest) {
			throw new GraphQLError("leaveRequestId does not exist", { extensions: { code: "NOT_FOUND" } });
		}
		if (leaveRequest.status !== "PENDING") {
			throw new GraphQLError("leave request is not in PENDING status", {
				extensions: { code: "CONFLICT" },
			});
		}

		const supervisor = await this.employeeServiceClient.findEmployee(supervisorId);
		if (!supervisor) {
			throw new GraphQLError("supervisorId does not exist", { extensions: { code: "NOT_FOUND" } });
		}

		const requester = await this.employeeServiceClient.findEmployee(leaveRequest.employeeId);
		if (requester?.supervisorId !== supervisorId) {
			throw new GraphQLError("supervisorId is not the direct supervisor of the leave requester", {
				extensions: { code: "FORBIDDEN" },
			});
		}

		// TODO(FEAT-8): create a Notification for leaveRequest.employeeId via payroll-subgraph
		// once servers/payroll lands on this branch (blocked on PR #106 — US-1 merging into
		// release/0.1.0).
		return this.leaveRequestRepository.review(leaveRequestId, decision, supervisorId);
	}
}
