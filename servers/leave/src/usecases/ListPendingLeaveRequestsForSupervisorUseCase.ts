import { BaseUseCase } from "server";
import EmployeeServiceClient from "../clients/EmployeeServiceClient";
import LeaveRequestRepository from "../repositories/LeaveRequestRepository";

export default class ListPendingLeaveRequestsForSupervisorUseCase extends BaseUseCase<
	{ supervisorId: string },
	unknown
> {
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

	async execute({ supervisorId }: { supervisorId: string }) {
		const reports = await this.employeeServiceClient.listDirectReports(supervisorId);
		if (reports.length === 0) return [];
		return this.leaveRequestRepository.findPendingForEmployees(reports.map((report) => report.id));
	}
}
