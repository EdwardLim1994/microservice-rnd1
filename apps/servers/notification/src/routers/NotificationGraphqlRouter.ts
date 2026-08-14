import type { GraphqlHandlerMap } from 'server';
import { GraphqlRouter } from 'server';
import { MarkAllNotificationsReadUseCase } from '../usecases/MarkAllNotificationsReadUseCase';
import { MarkNotificationReadUseCase } from '../usecases/MarkNotificationReadUseCase';
import { MyNotificationsUseCase } from '../usecases/MyNotificationsUseCase';
import { UnreadNotificationCountUseCase } from '../usecases/UnreadNotificationCountUseCase';

export class NotificationGraphqlRouter extends GraphqlRouter {
  // ponytail: userId arg on each operation — gateway forwards authenticated user's sub as this arg;
  // replace with ApolloServer context() injection when auth sprint lands
  get typeDefs(): string {
    return `#graphql
      extend schema @link(url: "https://specs.apollo.dev/federation/v2.14", import: ["@key"])

      enum NotificationType {
        LEAVE_REQUEST_RECEIVED
        LEAVE_REQUEST_DECIDED
        PAYROLL_GENERATED
      }

      type Notification @key(fields: "id") {
        id: ID!
        recipientId: ID!
        type: NotificationType!
        message: String!
        read: Boolean!
        createdAt: String!
      }

      type NotificationListResult {
        notifications: [Notification!]!
        total: Int!
        unreadCount: Int!
      }

      type Query {
        myNotifications(userId: ID!, page: Int, pageSize: Int): NotificationListResult!
        unreadNotificationCount(userId: ID!): Int!
      }

      type Mutation {
        markNotificationRead(id: ID!, userId: ID!): Notification!
        markAllNotificationsRead(userId: ID!): Int!
      }
    `;
  }

  get handlers(): GraphqlHandlerMap {
    return {
      Query: {
        myNotifications: MyNotificationsUseCase,
        unreadNotificationCount: UnreadNotificationCountUseCase,
      },
      Mutation: {
        markNotificationRead: MarkNotificationReadUseCase,
        markAllNotificationsRead: MarkAllNotificationsReadUseCase,
      },
    };
  }
}
