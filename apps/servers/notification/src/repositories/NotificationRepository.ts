import { BaseRepository } from 'server';
import type { PrismaClient } from '../../generated/prisma';

type NotificationRow = Awaited<
  ReturnType<PrismaClient['notification']['findFirst']>
> & {};

export class NotificationRepository extends BaseRepository<PrismaClient> {
  async create(data: {
    recipientId: string;
    type: string;
    message: string;
  }): Promise<NotificationRow> {
    return this.prisma.notification.create({ data: data as never });
  }

  async findByRecipient(
    recipientId: string,
    page: number,
    pageSize: number,
  ): Promise<{
    notifications: NotificationRow[];
    total: number;
    unreadCount: number;
  }> {
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where: { recipientId } }),
      this.prisma.notification.count({ where: { recipientId, read: false } }),
    ]);
    return { notifications, total, unreadCount };
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { recipientId, read: false },
    });
  }

  async markRead(id: string, recipientId: string): Promise<NotificationRow> {
    const existing = await this.prisma.notification.findFirst({
      where: { id },
    });
    if (!existing)
      throw Object.assign(new Error(`Notification ${id} not found`), {
        code: 5,
      });
    if (existing.recipientId !== recipientId)
      throw Object.assign(new Error('Forbidden'), { code: 7 });
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(recipientId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId, read: false },
      data: { read: true },
    });
    return result.count;
  }
}
