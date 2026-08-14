import type { GraphQLResolveInfo } from 'graphql';
import type { LeaveGraphqlContextType } from './context';
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

export type LeaveBalance = {
  __typename?: 'LeaveBalance';
  annualRemaining: Scalars['Int']['output'];
  employeeId: Scalars['ID']['output'];
  sickRemaining: Scalars['Int']['output'];
};

export type LeaveRequest = {
  __typename?: 'LeaveRequest';
  createdAt: Scalars['String']['output'];
  days: Scalars['Int']['output'];
  employeeId: Scalars['ID']['output'];
  endDate: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  leaveType: LeaveType;
  startDate: Scalars['String']['output'];
  status: LeaveStatus;
  unpaidDays: Scalars['Int']['output'];
  updatedAt: Scalars['String']['output'];
};

export type LeaveRequestListResult = {
  __typename?: 'LeaveRequestListResult';
  leaveRequests: Array<LeaveRequest>;
  total: Scalars['Int']['output'];
};

export enum LeaveStatus {
  Approved = 'APPROVED',
  Pending = 'PENDING',
  Rejected = 'REJECTED'
}

export enum LeaveType {
  Annual = 'ANNUAL',
  Sick = 'SICK',
  Unpaid = 'UNPAID'
}

export type Mutation = {
  __typename?: 'Mutation';
  reviewLeave: LeaveRequest;
  submitLeave: SubmitLeaveResult;
};


export type MutationReviewLeaveArgs = {
  decision: ReviewDecision;
  id: Scalars['ID']['input'];
};


export type MutationSubmitLeaveArgs = {
  input: SubmitLeaveInput;
};

export type Query = {
  __typename?: 'Query';
  myLeaveBalance: LeaveBalance;
  myLeaveRequests: LeaveRequestListResult;
  pendingApprovals: LeaveRequestListResult;
};


export type QueryMyLeaveRequestsArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<LeaveStatus>;
};


export type QueryPendingApprovalsArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
};

export type ReviewDecision = {
  decision: LeaveStatus;
};

export type SubmitLeaveInput = {
  endDate: Scalars['String']['input'];
  leaveType: LeaveType;
  startDate: Scalars['String']['input'];
};

export type SubmitLeaveResult = {
  __typename?: 'SubmitLeaveResult';
  balance: LeaveBalance;
  leaveRequest: LeaveRequest;
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
  LeaveRequest: LeaveRequest;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  LeaveRequest:
    ( { __typename: 'LeaveRequest' }
    & GraphQLRecursivePick<FederationTypes['LeaveRequest'], {"id":true}> );
}>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  LeaveBalance: ResolverTypeWrapper<LeaveBalance>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  LeaveRequest: ResolverTypeWrapper<LeaveRequest>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  LeaveRequestListResult: ResolverTypeWrapper<LeaveRequestListResult>;
  LeaveStatus: LeaveStatus;
  LeaveType: LeaveType;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  ReviewDecision: ReviewDecision;
  SubmitLeaveInput: SubmitLeaveInput;
  SubmitLeaveResult: ResolverTypeWrapper<SubmitLeaveResult>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  LeaveBalance: LeaveBalance;
  Int: Scalars['Int']['output'];
  ID: Scalars['ID']['output'];
  LeaveRequest: LeaveRequest | FederationReferenceTypes['LeaveRequest'];
  String: Scalars['String']['output'];
  LeaveRequestListResult: LeaveRequestListResult;
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  ReviewDecision: ReviewDecision;
  SubmitLeaveInput: SubmitLeaveInput;
  SubmitLeaveResult: SubmitLeaveResult;
  Boolean: Scalars['Boolean']['output'];
}>;

export type LeaveBalanceResolvers<ContextType = LeaveGraphqlContextType, ParentType extends ResolversParentTypes['LeaveBalance'] = ResolversParentTypes['LeaveBalance']> = ResolversObject<{
  annualRemaining?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  employeeId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  sickRemaining?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type LeaveRequestResolvers<ContextType = LeaveGraphqlContextType, ParentType extends ResolversParentTypes['LeaveRequest'] = ResolversParentTypes['LeaveRequest'], FederationReferenceType extends FederationReferenceTypes['LeaveRequest'] = FederationReferenceTypes['LeaveRequest']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['LeaveRequest']> | FederationReferenceType, FederationReferenceType, ContextType>;
  createdAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  days?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  employeeId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  endDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  leaveType?: Resolver<ResolversTypes['LeaveType'], ParentType, ContextType>;
  startDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['LeaveStatus'], ParentType, ContextType>;
  unpaidDays?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type LeaveRequestListResultResolvers<ContextType = LeaveGraphqlContextType, ParentType extends ResolversParentTypes['LeaveRequestListResult'] = ResolversParentTypes['LeaveRequestListResult']> = ResolversObject<{
  leaveRequests?: Resolver<Array<ResolversTypes['LeaveRequest']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = LeaveGraphqlContextType, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  reviewLeave?: Resolver<ResolversTypes['LeaveRequest'], ParentType, ContextType, RequireFields<MutationReviewLeaveArgs, 'decision' | 'id'>>;
  submitLeave?: Resolver<ResolversTypes['SubmitLeaveResult'], ParentType, ContextType, RequireFields<MutationSubmitLeaveArgs, 'input'>>;
}>;

export type QueryResolvers<ContextType = LeaveGraphqlContextType, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  myLeaveBalance?: Resolver<ResolversTypes['LeaveBalance'], ParentType, ContextType>;
  myLeaveRequests?: Resolver<ResolversTypes['LeaveRequestListResult'], ParentType, ContextType, Partial<QueryMyLeaveRequestsArgs>>;
  pendingApprovals?: Resolver<ResolversTypes['LeaveRequestListResult'], ParentType, ContextType, Partial<QueryPendingApprovalsArgs>>;
}>;

export type SubmitLeaveResultResolvers<ContextType = LeaveGraphqlContextType, ParentType extends ResolversParentTypes['SubmitLeaveResult'] = ResolversParentTypes['SubmitLeaveResult']> = ResolversObject<{
  balance?: Resolver<ResolversTypes['LeaveBalance'], ParentType, ContextType>;
  leaveRequest?: Resolver<ResolversTypes['LeaveRequest'], ParentType, ContextType>;
}>;

export type Resolvers<ContextType = LeaveGraphqlContextType> = ResolversObject<{
  LeaveBalance?: LeaveBalanceResolvers<ContextType>;
  LeaveRequest?: LeaveRequestResolvers<ContextType>;
  LeaveRequestListResult?: LeaveRequestListResultResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  SubmitLeaveResult?: SubmitLeaveResultResolvers<ContextType>;
}>;

