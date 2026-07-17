import type { TypedDocumentNode } from '@apollo/client';
import { gql } from '@apollo/client';

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsQueryData {
  notifications: Notification[];
}

export interface NotificationsQueryVariables {
  employeeId: string;
}

export const NOTIFICATIONS_QUERY: TypedDocumentNode<
  NotificationsQueryData,
  NotificationsQueryVariables
> = gql`
  query Notifications($employeeId: ID!) {
    notifications(employeeId: $employeeId) {
      id
      message
      read
      createdAt
    }
  }
`;

export interface MarkNotificationReadData {
  markNotificationRead: { id: string; read: boolean };
}

export interface MarkNotificationReadVariables {
  id: string;
}

export const MARK_NOTIFICATION_READ_MUTATION: TypedDocumentNode<
  MarkNotificationReadData,
  MarkNotificationReadVariables
> = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      read
    }
  }
`;
