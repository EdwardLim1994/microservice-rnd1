import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import {
  MARK_NOTIFICATION_READ_MUTATION,
  NOTIFICATIONS_QUERY,
  type Notification,
} from '../graphql/notification';

interface NotificationBellProps {
  // ponytail: no employee auth/session exists yet in this release (US-2 wires Authentik login
  // for employees) — defaults to a stub id read from localStorage in the meantime. Replace with
  // the logged-in employee's real id once that lands. Accepting it as an optional prop (rather
  // than reading localStorage unconditionally inside the component) keeps this testable without
  // depending on the test environment's own localStorage/window wiring.
  employeeId?: string;
}

export function NotificationBell({ employeeId }: NotificationBellProps = {}) {
  const [open, setOpen] = useState(false);
  const currentEmployeeId =
    employeeId ?? globalThis.localStorage?.getItem('currentEmployeeId') ?? '';
  const { data, error, refetch } = useQuery(NOTIFICATIONS_QUERY, {
    variables: { employeeId: currentEmployeeId },
    skip: !currentEmployeeId,
  });
  const [markRead] = useMutation(MARK_NOTIFICATION_READ_MUTATION);

  const notifications: Notification[] = data?.notifications ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleClickNotification(notification: Notification) {
    if (!notification.read) {
      await markRead({ variables: { id: notification.id } });
      refetch();
    }
  }

  function renderDropdownContent() {
    if (error) {
      return (
        <div data-testid="notification-error">Failed to load notifications</div>
      );
    }
    if (notifications.length === 0) {
      return <div>No notifications</div>;
    }
    return notifications.map((notification) => (
      <button
        type="button"
        key={notification.id}
        data-testid="notification-item"
        onClick={() => handleClickNotification(notification)}
      >
        {notification.message}
      </button>
    ));
  }

  return (
    <div>
      <button
        type="button"
        data-testid="notification-bell"
        onClick={() => setOpen((o) => !o)}
      >
        Notifications
        {unreadCount > 0 && (
          <span data-testid="notification-badge">{unreadCount}</span>
        )}
      </button>
      {open && (
        <div data-testid="notification-dropdown">{renderDropdownContent()}</div>
      )}
    </div>
  );
}
