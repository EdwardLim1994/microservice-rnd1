import { MockedProvider } from '@apollo/client/testing/react';
import { expect, test } from '@rstest/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationBell } from '../src/components/NotificationBell';
import { NOTIFICATIONS_QUERY } from '../src/graphql/notification';

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
