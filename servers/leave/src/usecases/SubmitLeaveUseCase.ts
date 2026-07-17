import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import LeaveRequestRepository from "../repositories/LeaveRequestRepository";

export interface SubmitLeaveInput {
	employeeId: string;
	leaveType: "ANNUAL" | "MEDICAL" | "EMERGENCY";
	startDate: string;
	endDate: string;
	reason: string;
}

export default class SubmitLeaveUseCase extends BaseUseCase<{ input: SubmitLeaveInput }, unknown> {
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

	// GraphQL's `submitLeave(input: SubmitLeaveInput!)` resolves with a wrapped `{ input: {...} }`
	// args object — must destructure `input` out of that wrapper.
	async execute({ input }: { input: SubmitLeaveInput }) {
		const reason = input.reason.trim();
		if (!reason) {
			throw new GraphQLError("reason must not be empty", { extensions: { code: "VALIDATION_ERROR" } });
		}

		const startDate = new Date(input.startDate);
		const endDate = new Date(input.endDate);
		if (startDate > endDate) {
			throw new GraphQLError("startDate must be before or equal to endDate", {
				extensions: { code: "VALIDATION_ERROR" },
			});
		}

		const employee = await this.employeeServiceClient.findEmployee(input.employeeId);
		if (!employee) {
			throw new GraphQLError("employeeId does not exist", { extensions: { code: "NOT_FOUND" } });
		}

		const overlapping = await this.leaveRequestRepository.findApprovedOverlapping(
			input.employeeId,
			startDate,
			endDate,
		);
		if (overlapping) {
			throw new GraphQLError("Overlapping approved leave already exists for this period", {
				extensions: { code: "CONFLICT" },
			});
		}

		return this.leaveRequestRepository.create({
			employeeId: input.employeeId,
			leaveType: input.leaveType,
			startDate,
			endDate,
			reason,
		});
	}
}
