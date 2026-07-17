import { BaseUseCase } from "server";
import LeaveRequestRepository from "../repositories/LeaveRequestRepository";

export default class ListLeaveRequestsUseCase extends BaseUseCase<{ employeeId: string }, unknown> {
	private readonly leaveRequestRepository: LeaveRequestRepository;

	constructor({ leaveRequestRepository }: { leaveRequestRepository: LeaveRequestRepository }) {
		super();
		this.leaveRequestRepository = leaveRequestRepository;
	}

	async execute({ employeeId }: { employeeId: string }) {
		return this.leaveRequestRepository.findByEmployee(employeeId);
	}
}
