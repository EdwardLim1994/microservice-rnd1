import { expect, mock, test } from 'bun:test';
import { ConsumeNotificationEventUseCase } from '../src/usecases/ConsumeNotificationEventUseCase';
import { MarkAllNotificationsReadUseCase } from '../src/usecases/MarkAllNotificationsReadUseCase';
import { MarkNotificationReadUseCase } from '../src/usecases/MarkNotificationReadUseCase';
import { MyNotificationsUseCase } from '../src/usecases/MyNotificationsUseCase';
import { UnreadNotificationCountUseCase } from '../src/usecases/UnreadNotificationCountUseCase';

function makeRepo() {
  return {
    create: mock(async (data: unknown) => data),
    findByRecipient: mock(async () => ({
      notifications: [],
      total: 0,
      unreadCount: 0,
    })),
    countUnread: mock(async () => 3),
    markRead: mock(async (id: string) => ({ id, read: true })),
    markAllRead: mock(async () => 5),
  };
}

test('ConsumeNotificationEventUseCase — persists event', async () => {
  const repo = makeRepo();
  const uc = new ConsumeNotificationEventUseCase({
    notificationRepository: repo as never,
  });
  await uc.execute({
    recipientId: 'u1',
    type: 'LEAVE_REQUEST_RECEIVED',
    message: 'received',
  });
  expect(repo.create).toHaveBeenCalledWith({
    recipientId: 'u1',
    type: 'LEAVE_REQUEST_RECEIVED',
    message: 'received',
  });
});

test('MyNotificationsUseCase — delegates to repo with defaults', async () => {
  const repo = makeRepo();
  const uc = new MyNotificationsUseCase({
    notificationRepository: repo as never,
  });
  const result = await uc.execute({ userId: 'u1' });
  expect(repo.findByRecipient).toHaveBeenCalledWith('u1', 1, 20);
  expect(result.total).toBe(0);
});

test('MyNotificationsUseCase — respects explicit page/pageSize', async () => {
  const repo = makeRepo();
  const uc = new MyNotificationsUseCase({
    notificationRepository: repo as never,
  });
  await uc.execute({ userId: 'u1', page: 2, pageSize: 10 });
  expect(repo.findByRecipient).toHaveBeenCalledWith('u1', 2, 10);
});

test('UnreadNotificationCountUseCase — returns count', async () => {
  const repo = makeRepo();
  const uc = new UnreadNotificationCountUseCase({
    notificationRepository: repo as never,
  });
  const count = await uc.execute({ userId: 'u1' });
  expect(repo.countUnread).toHaveBeenCalledWith('u1');
  expect(count).toBe(3);
});

test('MarkNotificationReadUseCase — marks single notification read', async () => {
  const repo = makeRepo();
  const uc = new MarkNotificationReadUseCase({
    notificationRepository: repo as never,
  });
  await uc.execute({ id: 'n1', userId: 'u1' });
  expect(repo.markRead).toHaveBeenCalledWith('n1', 'u1');
});

test('MarkAllNotificationsReadUseCase — returns updated count', async () => {
  const repo = makeRepo();
  const uc = new MarkAllNotificationsReadUseCase({
    notificationRepository: repo as never,
  });
  const count = await uc.execute({ userId: 'u1' });
  expect(repo.markAllRead).toHaveBeenCalledWith('u1');
  expect(count).toBe(5);
});
