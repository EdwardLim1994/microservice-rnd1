import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import type LeaveRequestRepository from "../repositories/LeaveRequestRepository";

export default class ListPendingLeaveRequestsForSupervisorUseCase extends BaseUseCase<
	{ supervisorId: string },
	unknown
> {
	private readonly leaveRequestRepository: LeaveRequestRepository;
	private readonly employeeServiceClient: EmployeeServiceClient;

	// EmployeeServiceClient is constructed internally (not container-injected) — see
	// SubmitLeaveUseCase's equivalent comment for why.
	constructor({
		leaveRequestRepository,
	}: { leaveRequestRepository: LeaveRequestRepository }) {
		super();
		this.leaveRequestRepository = leaveRequestRepository;
		this.employeeServiceClient = new EmployeeServiceClient();
	}

	async execute({ supervisorId }: { supervisorId: string }) {
		const reports =
			await this.employeeServiceClient.listDirectReports(supervisorId);
		if (reports.length === 0) return [];
		return this.leaveRequestRepository.findPendingForEmployees(
			reports.map((report) => report.id),
		);
	}
}
