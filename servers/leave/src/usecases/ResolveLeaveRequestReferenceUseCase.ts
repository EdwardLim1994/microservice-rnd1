import { BaseUseCase } from "server";
import type LeaveRequestRepository from "../repositories/LeaveRequestRepository";

export default class ResolveLeaveRequestReferenceUseCase extends BaseUseCase<
	{ id: string },
	unknown
> {
	private readonly leaveRequestRepository: LeaveRequestRepository;

	constructor({
		leaveRequestRepository,
	}: { leaveRequestRepository: LeaveRequestRepository }) {
		super();
		this.leaveRequestRepository = leaveRequestRepository;
	}

	execute({ id }: { id: string }) {
		return this.leaveRequestRepository.findById(id);
	}
}
