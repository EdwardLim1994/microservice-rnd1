import { BaseUseCase } from 'server';
import type { NotificationRepository } from '../repositories/NotificationRepository';

interface MarkReadArgs {
  id: string;
  // ponytail: userId from gateway; replace with JWT context when auth sprint lands
  userId: string;
}

export class MarkNotificationReadUseCase extends BaseUseCase<
  MarkReadArgs,
  unknown
> {
  private readonly notificationRepository: NotificationRepository;

  constructor({
    notificationRepository,
  }: { notificationRepository: NotificationRepository }) {
    super();
    this.notificationRepository = notificationRepository;
  }

  async execute(args: MarkReadArgs): Promise<unknown> {
    return this.notificationRepository.markRead(args.id, args.userId);
  }
}
