import type { GraphQLResolveInfo } from 'graphql';
import type { NotificationGraphqlContextType } from './context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  _FieldSet: { input: unknown; output: unknown; }
};

export type Mutation = {
  __typename?: 'Mutation';
  markAllNotificationsRead: Scalars['Int']['output'];
  markNotificationRead: Notification;
};


export type MutationMarkNotificationReadArgs = {
  id: Scalars['ID']['input'];
};

export type Notification = {
  __typename?: 'Notification';
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  message: Scalars['String']['output'];
  read: Scalars['Boolean']['output'];
  recipientId: Scalars['ID']['output'];
  type: NotificationType;
};

export type NotificationListResult = {
  __typename?: 'NotificationListResult';
  notifications: Array<Notification>;
  total: Scalars['Int']['output'];
  unreadCount: Scalars['Int']['output'];
};

export enum NotificationType {
  LeaveRequestDecided = 'LEAVE_REQUEST_DECIDED',
  LeaveRequestReceived = 'LEAVE_REQUEST_RECEIVED',
  PayrollGenerated = 'PAYROLL_GENERATED'
}

export type Query = {
  __typename?: 'Query';
  myNotifications: NotificationListResult;
  unreadNotificationCount: Scalars['Int']['output'];
};


export type QueryMyNotificationsArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ReferenceResolver<TResult, TReference, TContext> = (
      reference: TReference,
      context: TContext,
      info: GraphQLResolveInfo
    ) => Promise<TResult> | TResult;

      type ScalarCheck<T, S> = S extends true ? T : NullableCheck<T, S>;
      type NullableCheck<T, S> = Maybe<T> extends T ? Maybe<ListCheck<NonNullable<T>, S>> : ListCheck<T, S>;
      type ListCheck<T, S> = T extends (infer U)[] ? NullableCheck<U, S>[] : GraphQLRecursivePick<T, S>;
      export type GraphQLRecursivePick<T, S> = { [K in keyof T & keyof S]: ScalarCheck<T[K], S[K]> };
    

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping of federation types */
export type FederationTypes = ResolversObject<{
  Notification: Notification;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  Notification:
    ( { __typename: 'Notification' }
    & GraphQLRecursivePick<FederationTypes['Notification'], {"id":true}> );
}>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Notification: ResolverTypeWrapper<Notification>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  NotificationListResult: ResolverTypeWrapper<NotificationListResult>;
  NotificationType: NotificationType;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Mutation: Record<PropertyKey, never>;
  Int: Scalars['Int']['output'];
  ID: Scalars['ID']['output'];
  Notification: Notification | FederationReferenceTypes['Notification'];
  String: Scalars['String']['output'];
  Boolean: Scalars['Boolean']['output'];
  NotificationListResult: NotificationListResult;
  Query: Record<PropertyKey, never>;
}>;

export type MutationResolvers<ContextType = NotificationGraphqlContextType, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  markAllNotificationsRead?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  markNotificationRead?: Resolver<ResolversTypes['Notification'], ParentType, ContextType, RequireFields<MutationMarkNotificationReadArgs, 'id'>>;
}>;

export type NotificationResolvers<ContextType = NotificationGraphqlContextType, ParentType extends ResolversParentTypes['Notification'] = ResolversParentTypes['Notification'], FederationReferenceType extends FederationReferenceTypes['Notification'] = FederationReferenceTypes['Notification']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['Notification']> | FederationReferenceType, FederationReferenceType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  message?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  read?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  recipientId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['NotificationType'], ParentType, ContextType>;
}>;

export type NotificationListResultResolvers<ContextType = NotificationGraphqlContextType, ParentType extends ResolversParentTypes['NotificationListResult'] = ResolversParentTypes['NotificationListResult']> = ResolversObject<{
  notifications?: Resolver<Array<ResolversTypes['Notification']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  unreadCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = NotificationGraphqlContextType, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  myNotifications?: Resolver<ResolversTypes['NotificationListResult'], ParentType, ContextType, Partial<QueryMyNotificationsArgs>>;
  unreadNotificationCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = NotificationGraphqlContextType> = ResolversObject<{
  Mutation?: MutationResolvers<ContextType>;
  Notification?: NotificationResolvers<ContextType>;
  NotificationListResult?: NotificationListResultResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
}>;

