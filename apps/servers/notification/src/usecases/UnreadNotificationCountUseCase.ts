import { BaseUseCase } from 'server';
import type { NotificationRepository } from '../repositories/NotificationRepository';

interface UnreadCountArgs {
  // ponytail: userId from gateway header; replace with JWT context when auth sprint lands
  userId: string;
}

export class UnreadNotificationCountUseCase extends BaseUseCase<
  UnreadCountArgs,
  number
> {
  private readonly notificationRepository: NotificationRepository;

  constructor({
    notificationRepository,
  }: { notificationRepository: NotificationRepository }) {
    super();
    this.notificationRepository = notificationRepository;
  }

  async execute(args: UnreadCountArgs): Promise<number> {
    return this.notificationRepository.countUnread(args.userId);
  }
}
