import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationBell } from '../src/components/NotificationBell';
import {
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATIONS_QUERY,
} from '../src/graphql/notification';

// [E2E-2] Bell shows unread badge + payslip-ready message
test('shows an unread badge and the payslip message in the dropdown', async () => {
  const mock = {
    request: { query: NOTIFICATIONS_QUERY, variables: { employeeId: 'emp-1' } },
    result: {
      data: {
        notifications: [
          {
            id: 'notif-1',
            message: 'Your January 2026 payslip is ready',
            read: false,
            createdAt: '2026-01-01',
          },
        ],
      },
    },
  };

  render(
    <MockedProvider mocks={[mock]}>
      <NotificationBell employeeId="emp-1" />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('1'),
  );
  fireEvent.click(screen.getByTestId('notification-bell'));
  expect(screen.getByTestId('notification-dropdown')).toHaveTextContent(
    'payslip is ready',
  );
});

// Edge case: no notifications
test('shows an empty dropdown state when there are no notifications', async () => {
  const mock = {
    request: { query: NOTIFICATIONS_QUERY, variables: { employeeId: 'emp-1' } },
    result: { data: { notifications: [] } },
  };

  render(
    <MockedProvider mocks={[mock]}>
      <NotificationBell employeeId="emp-1" />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('notification-bell'));
  await waitFor(() => {
    expect(screen.getByTestId('notification-dropdown')).toHaveTextContent(
      'No notifications',
    );
  });
  expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
});

// Edge case: network failure fetching notifications
test('shows an error state in the dropdown on network failure', async () => {
  const mock = {
    request: { query: NOTIFICATIONS_QUERY, variables: { employeeId: 'emp-1' } },
    error: new Error('Network error'),
  };

  render(
    <MockedProvider mocks={[mock]}>
      <NotificationBell employeeId="emp-1" />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('notification-bell'));
  await waitFor(() => {
    expect(screen.getByTestId('notification-error')).toBeInTheDocument();
  });
});

// [INT-15-2/3] FEAT-15 — leave status notification, click marks read and navigates to /leave
test('clicking a leave status notification marks it read and navigates to /leave', async () => {
  const notificationsMock = {
    request: { query: NOTIFICATIONS_QUERY, variables: { employeeId: 'emp-1' } },
    result: {
      data: {
        notifications: [
          {
            id: 'notif-1',
            message:
              'Your leave request for 2026-08-01 – 2026-08-05 has been Approved.',
            read: false,
            createdAt: '2026-07-01',
          },
        ],
      },
    },
  };
  const markReadMock = {
    request: {
      query: MARK_NOTIFICATION_READ_MUTATION,
      variables: { id: 'notif-1' },
    },
    result: { data: { markNotificationRead: { id: 'notif-1', read: true } } },
  };
  const refetchMock = {
    request: { query: NOTIFICATIONS_QUERY, variables: { employeeId: 'emp-1' } },
    result: {
      data: {
        notifications: [
          {
            id: 'notif-1',
            message:
              'Your leave request for 2026-08-01 – 2026-08-05 has been Approved.',
            read: true,
            createdAt: '2026-07-01',
          },
        ],
      },
    },
  };
  const assignCalls: string[] = [];
  const originalAssign = window.location.assign;
  window.location.assign = ((url: string) => {
    assignCalls.push(url);
  }) as typeof window.location.assign;

  render(
    <MockedProvider mocks={[notificationsMock, markReadMock, refetchMock]}>
      <NotificationBell employeeId="emp-1" />
    </MockedProvider>,
  );

  await waitFor(() =>
    expect(screen.getByTestId('notification-badge')).toHaveTextContent('1'),
  );
  fireEvent.click(screen.getByTestId('notification-bell'));
  expect(screen.getByTestId('notification-dropdown')).toHaveTextContent(
    'has been',
  );
  fireEvent.click(screen.getByTestId('notification-item'));

  await waitFor(() => {
    expect(assignCalls).toEqual(['/leave']);
  });

  window.location.assign = originalAssign;
});

// Edge case: multiple status changes for the same leave request show one notification each
test('shows one notification per status-change event, not deduplicated', async () => {
  const mock = {
    request: { query: NOTIFICATIONS_QUERY, variables: { employeeId: 'emp-1' } },
    result: {
      data: {
        notifications: [
          {
            id: 'notif-1',
            message:
              'Your leave request for 2026-08-01 – 2026-08-05 has been Rejected.',
            read: false,
            createdAt: '2026-07-01',
          },
          {
            id: 'notif-2',
            message:
              'Your leave request for 2026-09-01 – 2026-09-05 has been Approved.',
            read: false,
            createdAt: '2026-07-02',
          },
        ],
      },
    },
  };

  render(
    <MockedProvider mocks={[mock]}>
      <NotificationBell employeeId="emp-1" />
    </MockedProvider>,
  );

  fireEvent.click(screen.getByTestId('notification-bell'));
  await waitFor(() => {
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2);
  });
});
