import { GraphQLError } from "graphql";
import { BaseUseCase } from "server";
import type NotificationRepository from "../repositories/NotificationRepository";

export default class MarkNotificationReadUseCase extends BaseUseCase<
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

	async execute({ id }: { id: string }) {
		const notification = await this.notificationRepository.findById(id);
		if (!notification) {
			throw new GraphQLError("notification does not exist", {
				extensions: { code: "NOT_FOUND" },
			});
		}
		return this.notificationRepository.markRead(id);
	}
}
