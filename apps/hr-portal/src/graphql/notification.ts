import { gql } from '@apollo/client';

export const NOTIFICATIONS_QUERY = gql`
  query Notifications($employeeId: ID!) {
    notifications(employeeId: $employeeId) {
      id
      message
      read
      createdAt
    }
  }
`;

export const MARK_NOTIFICATION_READ_MUTATION = gql`
  mutation MarkNotificationRead($id: ID!) {
    markNotificationRead(id: $id) {
      id
      read
    }
  }
`;
