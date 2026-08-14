import { BaseUseCase } from 'server';
import type { NotificationRepository } from '../repositories/NotificationRepository';

interface MyNotificationsArgs {
  // ponytail: userId injected by Apollo Router via x-user-id header forwarded as arg; replace with JWT context when auth sprint lands
  userId: string;
  page?: number | null;
  pageSize?: number | null;
}

interface NotificationListResult {
  notifications: unknown[];
  total: number;
  unreadCount: number;
}

export class MyNotificationsUseCase extends BaseUseCase<
  MyNotificationsArgs,
  NotificationListResult
> {
  private readonly notificationRepository: NotificationRepository;

  constructor({
    notificationRepository,
  }: { notificationRepository: NotificationRepository }) {
    super();
    this.notificationRepository = notificationRepository;
  }

  async execute(args: MyNotificationsArgs): Promise<NotificationListResult> {
    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 20;
    return this.notificationRepository.findByRecipient(
      args.userId,
      page,
      pageSize,
    );
  }
}
