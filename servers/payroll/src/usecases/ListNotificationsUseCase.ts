import { BaseUseCase } from "server";
import type NotificationRepository from "../repositories/NotificationRepository";

export default class ListNotificationsUseCase extends BaseUseCase<
	{ employeeId: string },
	unknown
> {
	private readonly notificationRepository: NotificationRepository;

	constructor({
		notificationRepository,
	}: { notificationRepository: NotificationRepository }) {
		super();
		this.notificationRepository = notificationRepository;
	}

	execute({ employeeId }: { employeeId: string }) {
		return this.notificationRepository.findByEmployee(employeeId);
	}
}
