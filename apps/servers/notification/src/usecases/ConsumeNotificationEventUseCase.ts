import { BaseUseCase } from 'server';
import type { NotificationRepository } from '../repositories/NotificationRepository';

interface NotificationEvent {
  recipientId: string;
  type: string;
  message: string;
}

export class ConsumeNotificationEventUseCase extends BaseUseCase<
  NotificationEvent,
  void
> {
  private readonly notificationRepository: NotificationRepository;

  constructor({
    notificationRepository,
  }: { notificationRepository: NotificationRepository }) {
    super();
    this.notificationRepository = notificationRepository;
  }

  async execute(event: NotificationEvent): Promise<void> {
    await this.notificationRepository.create({
      recipientId: event.recipientId,
      type: event.type,
      message: event.message,
    });
  }
}
