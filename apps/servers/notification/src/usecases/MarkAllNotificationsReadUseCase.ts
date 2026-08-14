import { BaseUseCase } from 'server';
import type { NotificationRepository } from '../repositories/NotificationRepository';

interface MarkAllReadArgs {
  // ponytail: userId from gateway; replace with JWT context when auth sprint lands
  userId: string;
}

export class MarkAllNotificationsReadUseCase extends BaseUseCase<
  MarkAllReadArgs,
  number
> {
  private readonly notificationRepository: NotificationRepository;

  constructor({
    notificationRepository,
  }: { notificationRepository: NotificationRepository }) {
    super();
    this.notificationRepository = notificationRepository;
  }

  async execute(args: MarkAllReadArgs): Promise<number> {
    return this.notificationRepository.markAllRead(args.userId);
  }
}
