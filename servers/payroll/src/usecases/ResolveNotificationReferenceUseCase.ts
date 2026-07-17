import { BaseUseCase } from "server";
import type NotificationRepository from "../repositories/NotificationRepository";

export default class ResolveNotificationReferenceUseCase extends BaseUseCase<
	{ id: string },
	unknown
> {
	private readonly notificationRepository: NotificationRepository;

	constructor({
		notificationRepository,
	}: { notificationRepository: NotificationRepository }) {
		super();
		this.notificationRepository = notificationRepository;
	}

	execute({ id }: { id: string }) {
		return this.notificationRepository.findById(id);
	}
}
