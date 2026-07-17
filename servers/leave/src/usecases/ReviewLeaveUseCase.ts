import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import PayrollServiceClient from "../clients/PayrollServiceClient";
import LeaveRequestRepository from "../repositories/LeaveRequestRepository";

export interface ReviewLeaveInput {
	leaveRequestId: string;
	supervisorId: string;
	decision: "APPROVED" | "REJECTED";
}

export default class ReviewLeaveUseCase extends BaseUseCase<{ input: ReviewLeaveInput }, unknown> {
	private readonly leaveRequestRepository: LeaveRequestRepository;
	private readonly employeeServiceClient: EmployeeServiceClient;
	private readonly payrollServiceClient: PayrollServiceClient;

	constructor({
		leaveRequestRepository,
		employeeServiceClient,
		payrollServiceClient,
	}: {
		leaveRequestRepository: LeaveRequestRepository;
		employeeServiceClient: EmployeeServiceClient;
		payrollServiceClient: PayrollServiceClient;
	}) {
		super();
		this.leaveRequestRepository = leaveRequestRepository;
		this.employeeServiceClient = employeeServiceClient;
		this.payrollServiceClient = payrollServiceClient;
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

		const reviewed = await this.leaveRequestRepository.review(leaveRequestId, decision, supervisorId);

		const decisionLabel = decision === "APPROVED" ? "Approved" : "Rejected";
		await this.payrollServiceClient.createNotification(
			leaveRequest.employeeId,
			`Your leave request for ${leaveRequest.startDate.toISOString().slice(0, 10)} – ${leaveRequest.endDate.toISOString().slice(0, 10)} has been ${decisionLabel}.`,
		);

		return reviewed;
	}
}
