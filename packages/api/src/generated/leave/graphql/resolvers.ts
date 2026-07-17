import type { GraphQLResolveInfo } from 'graphql';
import type { LeaveContextType } from './context';
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

export type Employee = {
  __typename?: 'Employee';
  id: Scalars['ID']['output'];
};

/** Represents a leave request submitted by an employee. */
export type LeaveRequest = {
  __typename?: 'LeaveRequest';
  /** The employee who submitted the leave request. */
  employee: Employee;
  /** End date of the leave period (inclusive). Format: YYYY-MM-DD. */
  endDate: Scalars['String']['output'];
  /** Unique internal identifier for the leave request. */
  id: Scalars['ID']['output'];
  /** Type of leave being requested. */
  leaveType: LeaveType;
  /** Reason provided by the employee for the leave request. */
  reason: Scalars['String']['output'];
  /**
   * Timestamp when the request was reviewed (approved or rejected).
   * Null if the request is still pending.
   */
  reviewedAt?: Maybe<Scalars['String']['output']>;
  /**
   * The supervisor who reviewed the request.
   * Null if the request is still pending.
   */
  reviewedBy?: Maybe<Employee>;
  /** Start date of the leave period (inclusive). Format: YYYY-MM-DD. */
  startDate: Scalars['String']['output'];
  /** Current status of the leave request. */
  status: LeaveStatus;
  /** Timestamp when the leave request was submitted. */
  submittedAt: Scalars['String']['output'];
};

/** Enumeration of possible leave request statuses. */
export enum LeaveStatus {
  /** Leave request has been approved by the supervisor. */
  Approved = 'APPROVED',
  /** Leave request has been submitted and is awaiting supervisor review. */
  Pending = 'PENDING',
  /** Leave request has been rejected by the supervisor. */
  Rejected = 'REJECTED'
}

/** Enumeration of supported leave types. */
export enum LeaveType {
  /** Standard annual leave entitlement. */
  Annual = 'ANNUAL',
  /** Emergency or urgent personal leave. */
  Emergency = 'EMERGENCY',
  /** Medical or sick leave. */
  Medical = 'MEDICAL'
}

export type Mutation = {
  __typename?: 'Mutation';
  /**
   * Approve or reject a pending leave request.
   * Only the direct supervisor of the requesting employee may perform this action.
   * Creates a notification record for the employee on successful review.
   * Returns the updated leave request.
   */
  reviewLeave: LeaveRequest;
  /**
   * Submit a new leave request for an employee.
   * Validates date range, employee existence, and overlapping approved leave.
   * Returns the created leave request with status PENDING.
   */
  submitLeave: LeaveRequest;
};


export type MutationReviewLeaveArgs = {
  input: ReviewLeaveInput;
};


export type MutationSubmitLeaveArgs = {
  input: SubmitLeaveInput;
};

export type Query = {
  __typename?: 'Query';
  /**
   * Fetch all leave requests submitted by a specific employee.
   * Sorted by submittedAt descending.
   */
  leaveRequests: Array<LeaveRequest>;
  /**
   * Fetch all pending leave requests for direct reports of a given supervisor.
   * Used to populate the supervisor leave approval view.
   */
  pendingLeaveRequestsForSupervisor: Array<LeaveRequest>;
};


export type QueryLeaveRequestsArgs = {
  employeeId: Scalars['ID']['input'];
};


export type QueryPendingLeaveRequestsForSupervisorArgs = {
  supervisorId: Scalars['ID']['input'];
};

/** Input for a supervisor to approve or reject a pending leave request. */
export type ReviewLeaveInput = {
  /** Decision: APPROVED or REJECTED. */
  decision: LeaveStatus;
  /** Internal ID of the leave request to review. */
  leaveRequestId: Scalars['ID']['input'];
  /** Internal ID of the supervisor performing the review. */
  supervisorId: Scalars['ID']['input'];
};

/** Input for submitting a new leave request. */
export type SubmitLeaveInput = {
  /** Internal ID of the employee submitting the request. */
  employeeId: Scalars['ID']['input'];
  /** End date of the leave period. Format: YYYY-MM-DD. Must be after or equal to startDate. */
  endDate: Scalars['String']['input'];
  /** Type of leave being requested. */
  leaveType: LeaveType;
  /** Reason for the leave request. Must be non-empty. */
  reason: Scalars['String']['input'];
  /** Start date of the leave period. Format: YYYY-MM-DD. Must be before or equal to endDate. */
  startDate: Scalars['String']['input'];
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
  Employee: Employee;
  LeaveRequest: LeaveRequest;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  Employee:
    ( { __typename: 'Employee' }
    & GraphQLRecursivePick<FederationTypes['Employee'], {"id":true}> );
  LeaveRequest:
    ( { __typename: 'LeaveRequest' }
    & GraphQLRecursivePick<FederationTypes['LeaveRequest'], {"id":true}> );
}>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Employee: ResolverTypeWrapper<Employee>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  LeaveRequest: ResolverTypeWrapper<LeaveRequest>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  LeaveStatus: LeaveStatus;
  LeaveType: LeaveType;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  ReviewLeaveInput: ReviewLeaveInput;
  SubmitLeaveInput: SubmitLeaveInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Employee: Employee | FederationReferenceTypes['Employee'];
  ID: Scalars['ID']['output'];
  LeaveRequest: LeaveRequest | FederationReferenceTypes['LeaveRequest'];
  String: Scalars['String']['output'];
  Mutation: Record<PropertyKey, never>;
  Query: Record<PropertyKey, never>;
  ReviewLeaveInput: ReviewLeaveInput;
  SubmitLeaveInput: SubmitLeaveInput;
  Boolean: Scalars['Boolean']['output'];
}>;

export type EmployeeResolvers<ContextType = LeaveContextType, ParentType extends ResolversParentTypes['Employee'] = ResolversParentTypes['Employee'], FederationReferenceType extends FederationReferenceTypes['Employee'] = FederationReferenceTypes['Employee']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['Employee']> | FederationReferenceType, FederationReferenceType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
}>;

export type LeaveRequestResolvers<ContextType = LeaveContextType, ParentType extends ResolversParentTypes['LeaveRequest'] = ResolversParentTypes['LeaveRequest'], FederationReferenceType extends FederationReferenceTypes['LeaveRequest'] = FederationReferenceTypes['LeaveRequest']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['LeaveRequest']> | FederationReferenceType, FederationReferenceType, ContextType>;
  employee?: Resolver<ResolversTypes['Employee'], ParentType, ContextType>;
  endDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  leaveType?: Resolver<ResolversTypes['LeaveType'], ParentType, ContextType>;
  reason?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  reviewedAt?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  reviewedBy?: Resolver<Maybe<ResolversTypes['Employee']>, ParentType, ContextType>;
  startDate?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['LeaveStatus'], ParentType, ContextType>;
  submittedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type MutationResolvers<ContextType = LeaveContextType, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = ResolversObject<{
  reviewLeave?: Resolver<ResolversTypes['LeaveRequest'], ParentType, ContextType, RequireFields<MutationReviewLeaveArgs, 'input'>>;
  submitLeave?: Resolver<ResolversTypes['LeaveRequest'], ParentType, ContextType, RequireFields<MutationSubmitLeaveArgs, 'input'>>;
}>;

export type QueryResolvers<ContextType = LeaveContextType, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  leaveRequests?: Resolver<Array<ResolversTypes['LeaveRequest']>, ParentType, ContextType, RequireFields<QueryLeaveRequestsArgs, 'employeeId'>>;
  pendingLeaveRequestsForSupervisor?: Resolver<Array<ResolversTypes['LeaveRequest']>, ParentType, ContextType, RequireFields<QueryPendingLeaveRequestsForSupervisorArgs, 'supervisorId'>>;
}>;

export type Resolvers<ContextType = LeaveContextType> = ResolversObject<{
  Employee?: EmployeeResolvers<ContextType>;
  LeaveRequest?: LeaveRequestResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
}>;

