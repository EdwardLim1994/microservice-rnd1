import { BaseUseCase } from "server";
import NotificationRepository from "../repositories/NotificationRepository";

export interface CreateNotificationInput {
	employeeId: string;
	message: string;
}

/**
 * Internal-use mutation for other subgraphs (e.g. leave-subgraph's ReviewLeaveUseCase) to raise
 * a notification without owning payroll's Postgres database directly. See payroll.graphql's
 * createNotification docstring.
 */
export default class CreateNotificationUseCase extends BaseUseCase<{ input: CreateNotificationInput }, unknown> {
	private readonly notificationRepository: NotificationRepository;

	constructor({ notificationRepository }: { notificationRepository: NotificationRepository }) {
		super();
		this.notificationRepository = notificationRepository;
	}

	async execute({ input }: { input: CreateNotificationInput }) {
		return this.notificationRepository.create({ employeeId: input.employeeId, message: input.message });
	}
}
